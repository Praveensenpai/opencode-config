// background-tasks has no server-side behavior: the TUI entry (tui.tsx) reads
// everything it needs from the SDK and the host data layer. This entrypoint
// exists so the package resolves cleanly as an opencode plugin.

import { Plugin } from "@opencode/plugin";

export default Plugin.define({
  id: "background-tasks",
  setup() {},
});
