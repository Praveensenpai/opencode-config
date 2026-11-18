// quota-fallback: keep an autonomous session running after quota exhaustion.
//
// The `retry` session hook runs after OpenCode classifies a provider failure and
// before the next attempt is scheduled. For quota/billing failures we move the
// session to the next free model in a circular rotation and tell OpenCode to
// retry, so the loop resumes instead of stopping.
//
// The rotation is circular: the cursor starts at the session's current model and
// advances one slot per switch, wrapping at the end of the list. A model that
// reports quota exhaustion is skipped for the blacklist TTL, and when every
// candidate is blocked the step waits for the first expiry instead of dying.
//
// Local model daemons (deeperseeker-rs / Mochi) report an empty token pool as a
// provider-internal "No active tokens available" error. That is treated as
// exhaustion too: the session switches off the local model onto the rotation.
//
// Options (in opencode.json):
//   "plugins": [
//     { "package": "./quota-fallback",
//       "options": {
//         "providers": ["opencode"],          // providers that count as free (default)
//         "fallbackModels": ["opencode/glm-5.3-flash-free"], // curated order
//         "strategy": "round-robin",          // "round-robin" (default) | "static"
//         "includeRateLimit": false,          // also switch on plain 429s
//         "rateLimitAttempts": 3,             // first attempt allowed before switching
//         "blacklistMinutes": 30,             // how long a quota-dead model is skipped
//         "maxWaitMs": 900000,                // cap on the wait when all models are blocked
//         "delayMs": 500                      // delay before retrying on the next model
//       } }
//   ]

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { Plugin } from "@opencode/plugin";
import {
  DEFAULT_DELAY_MS,
  asPositiveNumber,
  blacklistModel,
  blacklistTtlMs,
  createRuntime,
  isLocalExhaustion,
  isQuotaError,
  modelKey,
  pickNextModel,
  shouldFallback,
} from "./lib.js";

const LOG_PATH = join(
  os.homedir(),
  ".local",
  "share",
  "opencode",
  "quota-fallback.log",
);

const STORE_KEY = Symbol.for("opencode.quota-fallback.store");
const MAX_TRACKED_SESSIONS = 200;

function store() {
  if (!globalThis[STORE_KEY]) {
    globalThis[STORE_KEY] = {
      instances: new Set(),
      sessions: new Map(),
      blacklist: new Map(),
    };
  }
  return globalThis[STORE_KEY];
}

// One rotation per session, sharing the process-wide blacklist: quota is a
// provider-level fact, so it does not reset when a new session starts.
function sessionRuntime(sessionID) {
  const sessions = store().sessions;
  const existing = sessions.get(sessionID);
  if (existing) {
    sessions.delete(sessionID);
    sessions.set(sessionID, existing);
    return existing;
  }

  const runtime = createRuntime(store().blacklist);
  sessions.set(sessionID, runtime);
  while (sessions.size > MAX_TRACKED_SESSIONS) {
    const oldest = sessions.keys().next();
    if (oldest.done) break;
    sessions.delete(oldest.value);
  }
  return runtime;
}

function log(message) {
  try {
    mkdirSync(join(os.homedir(), ".local", "share", "opencode"), {
      recursive: true,
    });
    appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${message}\n`);
  } catch {
    // Logging must never break the session.
  }
}

export default Plugin.define({
  id: "quota-fallback",
  async setup(ctx) {
    const options = ctx.options ?? {};

    const registration = await ctx.session.hook("retry", async (event) => {
      try {
        if (!shouldFallback(event, options)) return;

        const runtime = sessionRuntime(event.sessionID);
        const from = modelKey(event.model) || "unknown";

        if (isQuotaError(event) || isLocalExhaustion(event)) {
          blacklistModel(
            runtime.blacklist,
            modelKey(event.model),
            blacklistTtlMs(options),
            runtime.clock.now(),
          );
        }

        const result = await pickNextModel(ctx, event, options, runtime);

        if (!result.model) {
          if (result.waitMs > 0) {
            event.decision = { retry: true, delay: result.waitMs };
            log(
              `${event.sessionID}: every free model is quota-blocked, retrying ${from} in ${Math.ceil(result.waitMs / 1000)}s (attempt ${event.attempt})`,
            );
          } else {
            log(
              `${event.sessionID}: ${event.error.type} but no free model is available`,
            );
          }
          return;
        }

        const target = modelKey(result.model);
        await ctx.session.switchModel({
          sessionID: event.sessionID,
          model: { providerID: result.model.providerID, id: result.model.id },
        });

        runtime.state.from = modelKey(event.model);
        runtime.state.last = target;

        event.decision = {
          retry: true,
          delay: asPositiveNumber(options.delayMs, DEFAULT_DELAY_MS),
        };

        log(
          `${event.sessionID}: ${from} -> ${target} after ${event.error.type} (attempt ${event.attempt})`,
        );
      } catch (error) {
        // Never turn a fallback problem into a session crash; let OpenCode's
        // original retry decision stand.
        log(
          `${event.sessionID}: fallback failed: ${error?.stack ?? error?.message ?? error}`,
        );
      }
    });

    store().instances.add(registration);
    log("quota-fallback loaded");

    return async () => {
      store().instances.delete(registration);
      await registration.dispose();
    };
  },
});
