# 🧵 Background Tasks (`background-tasks.md`)

## Why it's here

Once you run more than one thing at a time — a background shell, a detached
subagent, a PTY process — the session has no single place that answers the only
question that matters: *what is still running, and for how long?* This panel
answers it in the sidebar without stealing focus.

## What it does

`plugins/background-tasks/` renders a compact panel into the right sidebar
(`sidebar.content`) with one row per live task, newest first.

Each row shows:

- the command in **bold**, truncated to the panel width
- the last log line in a faded muted colour, truncated
- the elapsed time as `m:ss`, right-aligned

## Sources

The panel merges three live sources from the host data layer:

| Source | Data |
|---|---|
| Background shells | `data.shell.list()` + `client.shell.output()` |
| Detached subagents | `data.session.list()` (sessions with a `parentID`, status `running`) |
| PTY processes | `client.pty.list()` |

Updates arrive through `shell.*`, `pty.*`, and `session.status` events, so the
panel tracks new and finished tasks without polling on a fixed cadence.

## Interaction

| Input | Action |
|---|---|
| Click a row | Enlarge it ~30% (more log lines) and push the rows below down |
| Click the header count | Open the full panel |
| `j` / `k`, arrows | Move the selection |
| `enter` | Jump to the session that owns the task |
| `e` | Expand / collapse the selected row |
| `r` | Reverse the order (oldest first) |
| `o` | Open the enlarged panel |

## Configuration

The plugin reads its options from the `plugins` array in `opencode.json`:

```json
"plugins": [
  {
    "package": "./background-tasks",
    "options": { "width": 40 }
  }
]
```

- `width` — the assumed sidebar width used to truncate text (default `40`).

## Installation

`./install.sh` copies `index.js`, `tui.tsx`, and `package.json` into
`~/.config/opencode/background-tasks/` and adds the `plugins` entry to the
rendered `opencode.json`.

To capture local edits back into the repo, `update.sh` snapshots the live
`background-tasks/` directory into `plugins/background-tasks/`.
