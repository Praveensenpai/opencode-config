# 🖥️ CLI & TUI Settings (`cli-tui-settings.md`)

## Why it's here

OpenCode v2 splits its configuration into two files: `cli.json` for the CLI/TUI
behaviour and `tui.json` for the terminal theme. These are personal ergonomics —
they set how sessions behave and how the interface looks, independent of the
provider.

## What each file does

### `cli.json`

```json
{
  "$schema": "https://opencode.ai/v2/cli.json",
  "theme": { "name": "opencode" },
  "diffs": { "wrap": "word" },
  "session": {
    "sidebar": "auto",
    "scrollbar": false,
    "thinking": "hide",
    "permissions": "autoaccept",
    "grouping": "auto",
    "markdown": "rendered"
  },
  "animations": true,
  "tabs": { "scope": "global", "mode": "on" }
}
```

| Setting | Value | Effect |
|---|---|---|
| `diffs.wrap` | `word` | Wrap diffs at word boundaries instead of mid-token. |
| `session.thinking` | `hide` | Collapse the reasoning trace by default. |
| `session.permissions` | `autoaccept` | Skip per-action permission prompts. |
| `session.markdown` | `rendered` | Render markdown instead of raw source. |
| `session.scrollbar` | `false` | Hide the session scrollbar. |
| `tabs.mode` | `on` | Enable tabbed sessions. |

### `tui.json`

```json
{
  "$schema": "https://opencode.ai/tui.json",
  "theme": "system"
}
```

Follows the OS light/dark theme.

## How to use

- Both files are copied verbatim by `./install.sh` into
  `~/.config/opencode/`.
- `update.sh` captures the live copies back into `config/` so edits flow both
  ways.
- Change a value in `~/.config/opencode/cli.json`, restart OpenCode, then run
  `./update.sh` to snapshot it into the repo.