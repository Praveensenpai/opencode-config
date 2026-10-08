# 🧠 Models (`models.md`)

## Why it's here

One proxy, several behaviours. Rather than juggling separate providers or env
flags, the five variants are declared as models under the `mochi` provider so
they show up as selectable entries in OpenCode's model picker.

## What each one does

| Model ID | Name | `reasoning` | Use case |
|---|---|---|---|
| `v4.1flash` | DeepSeek V4.1 Flash | — | Default. Fast general chat and edits. |
| `v4.1flash-think` | DeepSeek V4.1 Flash (Deep Think) | yes | Hard problems: multi-step reasoning, refactors, debugging. |
| `v4.1flash-search` | DeepSeek V4.1 Flash (Web Search) | — | Questions needing current web info. |
| `v4.1flash-think-search` | DeepSeek V4.1 Flash (Think + Search) | yes | Deep reasoning over fresh facts. |
| `anthropic/claude-v4.1flash` | Claude V4.1 Flash | yes | Claude-compatible endpoint via the same proxy. |

Every variant shares identical limits and modalities:

```json
"attachment": true,
"limit": { "context": 128000, "output": 8192 },
"modalities": {
  "input": ["text", "image"],
  "output": ["text"]
}
```

- `reasoning: true` tells OpenCode to surface the model's thinking channel and
  enables the Deep Think toggle.
- `attachment: true` plus `image` input allows pasting screenshots.
- `context`/`output` are set to the proxy's real ceiling (128k / 8k) so
  compaction maths stays accurate.

## How to use

```bash
# One-shot with a specific variant
opencode run --model mochi/v4.1flash-think "refactor this module"

# Interactive: switch inside the TUI
/models
```

To add a variant, copy a block under `provider.mochi.models` in
`config/opencode.json.tmpl`, give it a unique key, then re-run `./install.sh`.