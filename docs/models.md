# 🧠 Models (`models.md`)

## Why it's here

The setup runs entirely on OpenRouter's free tier. Fourteen zero-cost models are
declared under the `or` provider so they show up as selectable entries in
OpenCode's model picker, and the quota-fallback plugin rotates between them when
one runs out of free usage.

## Default model

`"model": "or/particle-1-free"` — 1M context, 131k output, tool-enabled.

## Free model roster

| Model ID | Upstream | Context | Output | Tools |
|---|---|---|---|---|
| `particle-1-free` | particle-ai/particle-1:free | 1,048,576 | 131,072 | yes |
| `nemotron-3.5-lightning-free` | nvidia/nemotron-3.5-lightning:free | 1,000,000 | 262,144 | yes |
| `nemotron-3.5-super-vl-free` | nvidia/nemotron-3.5-super-vl:free | 1,000,000 | 8,192 | yes |
| `ling-3.2-flash-free` | inclusionai/ling-3.2-flash:free | 1,048,576 | 262,144 | yes |
| `inkling-2-small-free` | thinkingmachines/inkling-2-small:free | 1,048,576 | 131,072 | yes |
| `nemotron-3-ultra-free` | nvidia/nemotron-3-ultra-550b-a55b:free | 1,000,000 | 32,000 | yes |
| `ernie-5.5-flash-preview-free` | baidu/ernie-5.5-flash-preview:free | 1,020,000 | 32,000 | yes |
| `nemotron-3-nano-omni-free` | nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free | 256,000 | 65,536 | yes |
| `gemma-4-31b-free` | google/gemma-4-31b-it:free | 262,144 | 32,768 | yes |
| `gemma-4-26b-a4b-free` | google/gemma-4-26b-a4b-it:free | 262,144 | 32,768 | yes |
| `north-mini-code-free` | cohere/north-mini-code:free | 256,000 | 64,000 | yes |
| `flint-free` | recursive/flint-v1.0:free | 262,144 | 262,144 | yes |
| `dots3-note-preview-free` | dots-studio/dots-3-note-preview:free | 512,000 | 32,000 | yes |
| `lfm3-1.7b-free` | liquid/lfm-3-1.7b:free | 262,144 | 32,768 | no |

Every entry declares `cost: [{ input: 0, output: 0, cache: { read: 0, write: 0 } }]`,
which is what the quota-fallback plugin checks before considering a model free.

- `capabilities.tools: false` models are skipped by the rotation, since an agent
  loop without tool support cannot continue a session.
- `limit.context` / `limit.output` feed compaction maths.

## How to use

```bash
# One-shot with a specific variant
opencode run --model or/nemotron-3.5-lightning-free "refactor this module"

# Interactive: switch inside the TUI
/models
```

To add a model, copy a block under `providers.or.models` in
`config/opencode.json.tmpl`, give it a unique key, add it to the plugin's
`fallbackModels` list, then re-run the installer.
