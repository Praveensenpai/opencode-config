// Shared RPC definition for interval-ping.
//
// Imported by both the server plugin (index.js), which registers the
// implementation, and the TUI plugin (tui.tsx), which calls it to render a
// live "next ping in X" countdown in the prompt footer.

import { Rpc } from "@opencode/plugin/rpc";

export const IntervalPing = Rpc.define({
  id: "interval-ping",
  methods: {
    // Current schedule for one session.
    //   active  – is a timer running for this session?
    //   nextAt  – epoch ms of the next ping (0 when inactive)
    //   minutes – configured interval in minutes (0 when inactive)
    status: {
      input: {
        type: "object",
        properties: { sessionID: { type: "string" } },
        required: ["sessionID"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          active: { type: "boolean" },
          nextAt: { type: "number" },
          minutes: { type: "number" },
        },
        required: ["active", "nextAt", "minutes"],
        additionalProperties: false,
      },
    },
  },
  events: {
    // Fired whenever a session's schedule changes (start/stop/tick) so a
    // listener can refresh without polling.
    changed: {
      schema: {
        type: "object",
        properties: { sessionID: { type: "string" } },
        required: ["sessionID"],
        additionalProperties: false,
      },
    },
  },
});