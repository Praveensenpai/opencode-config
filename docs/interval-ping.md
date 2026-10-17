# ⏰ Interval Ping (`interval-ping.md`)

## Why it's here

Long-running agent sessions are easy to leave unattended. Sometimes you want the
session to keep nudging itself on a fixed cadence — a heartbeat that re-enters
the transcript so the agent stays on-task, or a simple "are you still there"
check. There was no built-in way to schedule that, so this plugin adds one.

## What it does

`plugins/interval-ping/` is a native OpenCode plugin with two halves:

- **`index.js`** — the server plugin. It registers the `/ping` command and owns
the timers. Each tick posts the configured message into the session transcript
without triggering a new agent turn.
- **`rpc.js`** — the shared RPC definition (`IntervalPing`) that exposes the
  current schedule for a session.
- **`tui.tsx`** — the TUI plugin. It reads the schedule over RPC and renders a
  live `⏰ M:SS` countdown in the prompt footer, plus a `Ping` status block in
  the right sidebar with the next ping and the configured interval.

## How to use

```text
/ping        start (or restart) at the configured default interval
/ping 10     start (or restart) at 10 minutes
/ping stop   stop the timer for this session
```

Timers are per-session, so two sessions can run different intervals at once.
The footer countdown only shows while a timer is active.

The sidebar block is always visible: `Ping` with `next M:SS` and
`every N min · /ping stop` while running, or `idle` with a `/ping 5 to start`
hint when stopped.

## Configuration

The plugin reads its options from the `plugins` array in `opencode.json`:

```json
"plugins": [
  {
    "package": "./interval-ping",
    "options": { "message": "⏰ ping", "intervalMinutes": 5 }
  }
]
```

- `message` — the string posted on each tick (default `ping`).
- `intervalMinutes` — the default interval for a bare `/ping` (default `5`).

## Installation

`./install.sh` copies `index.js`, `rpc.js`, `tui.tsx`, and `package.json` into
`~/.config/opencode/interval-ping/` and adds the `plugins` entry to the rendered
`opencode.json`. The plugin needs `@opencode/plugin`, which the installer
resolves via the root `package.json` dependency install.

To capture local edits back into the repo, `update.sh` snapshots the live
`interval-ping/` directory into `plugins/interval-ping/`.
