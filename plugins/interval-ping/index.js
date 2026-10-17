// interval-ping: send a fixed message into a session on a repeating interval.
//
// Usage (in any session):
//   /ping        start (or restart) at the default interval
//   /ping 10     start (or restart) at 10 minutes
//   /ping stop   stop the timer for this session
//
// Options come from opencode.json(c):
//   "plugins": [
//     { "package": "./interval-ping",
//       "options": { "message": "ping", "intervalMinutes": 5 } }
//   ]
//
// Each tick posts the configured string verbatim as a synthetic session
// message, so it shows up in the transcript without triggering the agent.
//
// The schedule is also exposed over RPC (see rpc.js) so the TUI plugin in
// tui.tsx can render a live countdown in the prompt footer and a status block
// in the right sidebar.
//
// Timers live in a process-global store rather than in this module's closure.
// OpenCode reloads plugins whenever a watched file changes, and each reload
// disposes the previous instance. Keeping the schedule outside the instance
// means a reload re-arms the existing timers instead of silently dropping
// them, which is what made an active /ping look idle after an edit.

import { Plugin } from "@opencode/plugin";
import { IntervalPing } from "./rpc.js";

const DEFAULT_MESSAGE = "ping";
const DEFAULT_MINUTES = 5;
const STORE_KEY = Symbol.for("opencode.interval-ping.store");

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// One store per process, shared by every plugin instance and reload.
function store() {
  if (!globalThis[STORE_KEY]) {
    globalThis[STORE_KEY] = {
      // sessionID -> { minutes, nextAt, handle }
      timers: new Map(),
      // newest plugin context, swapped on every reload
      ctx: null,
      message: DEFAULT_MESSAGE,
      emit: null,
    };
  }
  return globalThis[STORE_KEY];
}

export default Plugin.define({
  id: "interval-ping",
  async setup(ctx) {
    const options = ctx.options || {};
    const state = store();
    state.ctx = ctx;
    state.message =
      typeof options.message === "string" ? options.message : DEFAULT_MESSAGE;
    const defaultMinutes = isPositiveNumber(options.intervalMinutes)
      ? options.intervalMinutes
      : DEFAULT_MINUTES;

    function notify(sessionID, text) {
      const current = state.ctx;
      if (!current) {
        return;
      }
      current.session
        .synthetic({ sessionID: sessionID, text: text })
        .catch(function () {});
    }

    function emitChanged(sessionID) {
      if (typeof state.emit !== "function") {
        return;
      }
      state.emit(sessionID);
    }

    // A single tick: deliver, advance the schedule, then re-arm. Using
    // setTimeout (not setInterval) keeps the remaining time accurate across
    // reloads, because the next delay is always derived from nextAt.
    function arm(sessionID) {
      const entry = state.timers.get(sessionID);
      if (!entry) {
        return;
      }
      if (entry.handle) {
        clearTimeout(entry.handle);
      }
      const delay = Math.max(0, entry.nextAt - Date.now());
      entry.handle = setTimeout(function () {
        const live = state.timers.get(sessionID);
        if (!live) {
          return;
        }
        live.nextAt = Date.now() + live.minutes * 60000;
        notify(sessionID, state.message);
        emitChanged(sessionID);
        arm(sessionID);
      }, delay);
      if (typeof entry.handle.unref === "function") {
        entry.handle.unref();
      }
    }

    function stop(sessionID) {
      const entry = state.timers.get(sessionID);
      if (!entry) {
        return false;
      }
      if (entry.handle) {
        clearTimeout(entry.handle);
      }
      state.timers.delete(sessionID);
      emitChanged(sessionID);
      return true;
    }

    function start(sessionID, minutes) {
      stop(sessionID);
      state.timers.set(sessionID, {
        minutes: minutes,
        nextAt: Date.now() + minutes * 60000,
        handle: null,
      });
      arm(sessionID);
      emitChanged(sessionID);
    }

    const registration = await ctx.rpc.register(IntervalPing, {
      status: async function (input) {
        const entry = state.timers.get(input.sessionID);
        if (!entry) {
          return { active: false, nextAt: 0, minutes: 0 };
        }
        return {
          active: true,
          nextAt: entry.nextAt,
          minutes: entry.minutes,
        };
      },
    });

    state.emit = function (sessionID) {
      registration.events
        .emit("changed", { sessionID: sessionID })
        .catch(function () {});
    };

    // Re-arm anything inherited from the previous instance. The delay is
    // recomputed from nextAt, so a reload never restarts or skips a beat.
    state.timers.forEach(function (_entry, sessionID) {
      arm(sessionID);
    });

    await ctx.command.transform(function (editor) {
      editor.add({
        name: "ping",
        description: "Start or stop a repeating message in this session",
        execute: async function (input) {
          const sessionID = input.sessionID;
          const prompt = input.prompt;
          let arg = "";
          if (prompt && typeof prompt.text === "string") {
            arg = prompt.text;
          }
          arg = arg.trim();

          if (arg.toLowerCase() === "stop") {
            const wasRunning = stop(sessionID);
            if (wasRunning) {
              await notify(sessionID, "interval-ping stopped");
            } else {
              await notify(sessionID, "interval-ping is not running");
            }
            return;
          }

          let minutes = defaultMinutes;
          if (arg.length !== 0) {
            const parsed = Number(arg);
            if (!isPositiveNumber(parsed)) {
              await notify(
                sessionID,
                "invalid interval, use minutes e.g. /ping 10",
              );
              return;
            }
            minutes = parsed;
          }

          start(sessionID, minutes);
          await notify(
            sessionID,
            "interval-ping started, every " + minutes + " min in this session",
          );
        },
      });
    });

    // Deliberately do not clear timers here: this runs on every hot reload,
    // and the whole point of the shared store is to survive that. `stop` and
    // `/ping stop` are the only things that end a schedule.
    return function cleanup() {
      void registration.dispose();
    };
  },
});
