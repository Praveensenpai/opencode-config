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
// tui.tsx can render a live countdown in the prompt footer.

import { Plugin } from "@opencode/plugin";
import { IntervalPing } from "./rpc.js";

const DEFAULT_MESSAGE = "ping";
const DEFAULT_MINUTES = 5;

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export default Plugin.define({
  id: "interval-ping",
  async setup(ctx) {
    const options = ctx.options || {};
    const message =
      typeof options.message === "string" ? options.message : DEFAULT_MESSAGE;
    const defaultMinutes = isPositiveNumber(options.intervalMinutes)
      ? options.intervalMinutes
      : DEFAULT_MINUTES;

    // sessionID -> { handle, minutes, nextAt }
    const timers = new Map();

    // Registered below; used to emit schedule-change events.
    let registration;

    function notify(sessionID, text) {
      return ctx.session
        .synthetic({ sessionID: sessionID, text: text })
        .catch(function () {});
    }

    function emitChanged(sessionID) {
      if (!registration) {
        return;
      }
      registration.events
        .emit("changed", { sessionID: sessionID })
        .catch(function () {});
    }

    function stop(sessionID) {
      const entry = timers.get(sessionID);
      if (!entry) {
        return false;
      }
      clearInterval(entry.handle);
      timers.delete(sessionID);
      emitChanged(sessionID);
      return true;
    }

    function start(sessionID, minutes) {
      stop(sessionID);
      const periodMs = minutes * 60000;
      const entry = {
        handle: null,
        minutes: minutes,
        nextAt: Date.now() + periodMs,
      };
      entry.handle = setInterval(function () {
        entry.nextAt = Date.now() + periodMs;
        void notify(sessionID, message);
        emitChanged(sessionID);
      }, periodMs);
      if (typeof entry.handle.unref === "function") {
        entry.handle.unref();
      }
      timers.set(sessionID, entry);
      emitChanged(sessionID);
    }

    registration = await ctx.rpc.register(IntervalPing, {
      status: async function (input) {
        const sessionID = input.sessionID;
        const entry = timers.get(sessionID);
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

    return function cleanup() {
      timers.forEach(function (entry) {
        clearInterval(entry.handle);
      });
      timers.clear();
      if (registration) {
        void registration.dispose();
      }
    };
  },
});