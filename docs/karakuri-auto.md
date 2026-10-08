# ⚙️ Automatic Karakuri (`karakuri-auto.md`)

## Why it's here

Installing the repo bootstraps karakuri once. But nothing made OpenCode *use* it
during normal work — the agent only ran `karakuri audit` / `karakuri digest` if
it happened to remember. This plugin closes that gap so the closed-loop
workflows run automatically.

## What it does

`plugins/karakuri/plugin.js` is a native OpenCode plugin wired to the
`tool.execute.after` hook. After every file-mutating tool call it schedules a
debounced background run:

1. `karakuri ensure .` — once per session: detect the project stack and install
   only the generic guardrails plus the matching language skills.
2. `karakuri digest .` — refresh `CODEBASE.md` when source files changed.
3. `karakuri audit .` — enforce clean-code limits and clippy.

Results are appended to `~/.local/share/opencode/karakuri-auto.log` so they
never interrupt the session. Failures are logged, not raised — the plugin never
blocks your turn.

The `ensure` step runs at most once per OpenCode session so a long editing
session does not repeatedly rewrite skill files; `digest` and `audit` keep
running on every debounced pass.

## Guards

- Only runs for file-mutating tools (`edit`, `write`, `patch`, `multiedit`).
- Debounced (`KARAKURI_DEBOUNCE_MS`, default 4000ms) so a burst of edits
  triggers one run.
- `ensure` is skipped after its first successful run in the session.
- Skipped entirely when `karakuri` is not on `PATH`.
- Skipped when `KARAKURI_AUTO=0`.
- Only runs inside a directory that looks like a project (has `.git`,
  `Cargo.toml`, `pyproject.toml`, or `package.json`), to avoid pointless runs
  in `$HOME`.

## How to use

- `./install.sh` copies the plugin into `~/.config/opencode/plugins/` and adds
  a `"plugin"` entry to `opencode.json`.
- Disable without uninstalling: export `KARAKURI_AUTO=0` before starting
  OpenCode.
- Tune the debounce: `KARAKURI_DEBOUNCE_MS=8000`.
- Inspect output: `tail -f ~/.local/share/opencode/karakuri-auto.log`.