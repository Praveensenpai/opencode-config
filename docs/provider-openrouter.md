# 🌐 OpenRouter Provider (`provider-openrouter.md`)

## Why it's here

The setup no longer depends on a local proxy. Every model is an OpenRouter
`:free` endpoint, so any machine with network access and a key gets the same
behaviour — no daemon to run.

## Config

```json
"providers": {
  "or": {
    "name": "OpenRouter (free)",
    "package": "@opencode/ai/providers/openai-compatible",
    "settings": {
      "baseURL": "https://openrouter.ai/api/v1",
      "apiKey": "__OPENROUTER_API_KEY__"
    },
    "models": { "...": "..." }
  }
}
```

The `__OPENROUTER_API_KEY__` token is replaced at install time. The installer
prompts for the key when run interactively; in non-interactive contexts it writes
a `CHANGE_ME` placeholder and warns, so no secret is ever baked into the binary.
Set `OPENROUTER_API_KEY` in the environment to skip the prompt.

## Key handling

- The committed template contains only the token, never a real key.
- `update.sh` replaces the live key back with the token on capture.
- The rendered `opencode.json` is written with mode `0600`.
