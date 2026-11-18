# 🔄 Quota Fallback (`quota-fallback.md`)

## Why it's here

Free tiers run out. Without intervention, an autonomous session stops the moment
the active model reports exhausted quota. The quota-fallback plugin hooks
OpenCode's `retry` event and moves the session to the next free model before the
retry is scheduled, so the loop resumes instead of dying.

## What it does

- Watches for quota/billing failures (`provider.quota`, `provider.free-limit`,
  budget limits, 402s, and quota wording in generic 429s, including OpenRouter's
  `free-models-per-day` / `free daily limit` messages).
- Switches on plain rate limits too (`includeRateLimit: true`) on the first retry
  (`rateLimitAttempts: 1`), since an account-wide free-daily limit affects every
  OpenRouter free model at once. The rotation then lands on an `opencode/` Zen
  model, which does not consume OpenRouter's daily quota.
- Treats a local daemon's "no active tokens" error as exhaustion too.
- Blacklists the exhausted model for `blacklistMinutes` (30) so it is skipped.
- Advances a circular cursor through `fallbackModels` one slot per switch.
- When every candidate is blocked, waits for the first blacklist expiry instead
  of failing, capped at `maxWaitMs` (15 min).

## Options

```json
{
  "package": "./quota-fallback",
  "options": {
    "providers": ["opencode", "or"],
    "fallbackModels": ["opencode/glm-5.3-flash-free", "..."],
    "strategy": "round-robin",
    "includeRateLimit": true,
    "rateLimitAttempts": 1,
    "blacklistMinutes": 30,
    "maxWaitMs": 900000,
    "delayMs": 500
  }
}
```

| Option | Default | Meaning |
|---|---|---|
| `providers` | `["opencode", "opencode-go"]` | Providers whose zero-cost models are eligible. |
| `fallbackModels` | built-in priority list | Curated rotation order. |
| `strategy` | `round-robin` | `round-robin` or `static`. |
| `includeRateLimit` | `false` | Also switch on plain rate limits. |
| `rateLimitAttempts` | `3` | Attempts before switching on a 429. |
| `blacklistMinutes` | `30` | Skip a quota-dead model for this long. |
| `maxWaitMs` | `900000` | Cap on waiting when all models are blocked. |
| `delayMs` | `500` | Delay before retrying on the next model. |

## Source

The plugin ships as embedded assets under `plugins/quota-fallback/`. It is
installed to `~/.config/opencode/quota-fallback/` and loaded via the `plugins`
array in `opencode.json`. Behaviour is covered by `test.js` (`node --test test.js`).
