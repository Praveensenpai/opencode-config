# 🍡 Mochi Provider (`provider-mochi.md`)

## Why it's here

The stock OpenCode setup talks to paid hosted providers. This machine routes
everything through a local [deeperseeker-rs](https://github.com/Praveensenpai/deeperseeker-rs)
proxy reachable at `http://mochi:4000/v1`, which speaks the OpenAI-compatible
API. Declaring it as a provider means OpenCode treats it like any first-class
backend: model picker, streaming, tool calls, image input, all work.

## What it does

```json
"provider": {
  "mochi": {
    "npm": "@ai-sdk/openai-compatible",
    "name": "Mochi (deeperseeker-rs)",
    "options": {
      "baseURL": "__MOCHI_BASE_URL__",
      "apiKey": "__MOCHI_API_KEY__"
    }
  }
}
```

| Key | Meaning |
|---|---|
| `npm` | Use the OpenAI-compatible AI SDK adapter. |
| `baseURL` | Proxy root; templated so the host can differ per machine. |
| `apiKey` | Proxy token; templated and never committed. |

Also tied to this provider:

- `"model": "mochi/v4.1flash"` — default model on startup.
- `"disabled_providers": ["opencode"]` — hide the built-in OpenCode
  provider so only Mochi shows in the picker.

## How to use

- Put the real values in `.env` (`MOCHI_BASE_URL`, `MOCHI_API_KEY`), then run
  `./install.sh`. The template is rendered into
  `~/.config/opencode/opencode.json` at mode `600`.
- To point at a different proxy, edit `.env` and re-run `./install.sh`.
- The committed template only ever contains `__MOCHI_BASE_URL__` and
  `__MOCHI_API_KEY__` placeholders.
