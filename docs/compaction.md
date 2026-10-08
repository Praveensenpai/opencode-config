# 🧮 Compaction (`compaction.md`)

## Why it's here

Long agent sessions overflow the context window. OpenCode compacts history by
summarising old turns once the window fills. The defaults are conservative; with
a 128k-context proxy there's room to reserve more, so compaction runs later and
keeps more live context in play.

## What it does

```json
"compaction": {
  "auto": true,
  "reserved": 64000
}
```

| Key | Value | Meaning |
|---|---|---|
| `auto` | `true` | Compact automatically without asking. |
| `reserved` | `64000` | Tokens held back for the reply and summarisation. |

With a 128k window, reserving 64k means roughly half the window stays available
for output and the compaction pass itself, while the other half carries live
conversation before a summary triggers. Raise `reserved` for more headroom on
huge diffs; lower it to keep more raw history.

## Why 64000

- The proxy advertises an 8k output ceiling, but reasoning (Deep Think)
  variants emit a much longer internal trace that still counts against the
  window.
- 64k leaves slack for a long chain-of-thought plus a large file rewrite
  without mid-task truncation.
- It is half of the 128k context, an easy mental ratio to tune from.

## How to use

- Already applied via `config/opencode.json.tmpl`; no action needed after
  `./install.sh`.
- To change it, edit the `reserved` value, re-run `./install.sh`, and restart
  OpenCode.
- If sessions forget too early, lower `reserved`. If replies get cut off during
  deep-think runs, raise it.