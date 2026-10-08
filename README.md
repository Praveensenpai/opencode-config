<div align="center">

# 🌸 設定 — OpenCode Config

**One private repo that rebuilds my entire OpenCode setup on any machine — provider, models, TUI ergonomics, and automatic karakuri enforcement.**

[![Private](https://img.shields.io/badge/repo-private-red?style=flat-square&logo=github)](https://github.com/Praveensenpai/opencode-config)
[![Shell](https://img.shields.io/badge/shell-bash-4EAA25?style=flat-square&logo=gnubash&logoColor=white)](#)
[![OpenCode](https://img.shields.io/badge/opencode-v2-7C3AED?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#-license)

</div>

---

## 🎯 Why this exists

My OpenCode setup is not stock. It runs a local OpenAI-compatible proxy, ships five model variants, hides the default provider, tunes compaction, and layers in a rules-and-skills system. None of that is reproducible from memory, and the one file holding a secret must never be committed.

This repo is the source of truth. Clone it on a new machine, run one script, and the whole environment comes back — secrets rendered from a local `.env` that stays out of git.

> **Threat model:** the committed config is secret-free by construction. Real values are injected at install time from `.env` (gitignored) or an interactive prompt.

---

## 🧭 What it restores

```text
                    ┌────────────────────────────────┐
                    │  ~/Projects/opencode-config    │
                    │  this repo — source of truth   │
                    └───────────────┬────────────────┘
                                    │ ./install.sh
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ ~/.config/       │     │ ~/.opencode/bin/ │     │ karakuri         │
│   opencode/      │     │   opencode2      │     │ rules + skills   │
│ opencode.json    │     │ launcher wrapper │     │ bootstrap + sync │
│ cli.json tui.json│     └──────────────────┘     └──────────────────┘
│ plugins/karakuri │
└────────┬─────────┘
         ▼
┌──────────────────────────────────────────────┐
│ plugin: tool.execute.after → karakuri        │
│ digest + audit (debounced, background)       │
└──────────────────────────────────────────────┘
```

---

## 🪄 One-Liner Magic

```bash
git clone git@github.com:Praveensenpai/opencode-config.git "${XDG_DATA_HOME:-$HOME/.local/share}/opencode-config" && \
  "${XDG_DATA_HOME:-$HOME/.local/share}/opencode-config/install.sh"
```

Then put real values in the repo's `.env` (copy `.env.example`) and re-run `./install.sh` if the key prompt was left blank.

---

## ✨ Feature matrix

- 🔌 **Mochi provider** — routes OpenCode through a local `deeperseeker-rs` proxy over the OpenAI-compatible API. [docs](docs/provider-mochi.md)
- 🧠 **Five model variants** — Flash, Deep Think, Web Search, Think+Search, and a Claude-compatible endpoint, all as first-class picker entries. [docs](docs/models.md)
- 🧮 **Tuned compaction** — reserves 64k of a 128k window so deep-think traces never truncate mid-task. [docs](docs/compaction.md)
- 🖥️ **CLI & TUI ergonomics** — auto-accept permissions, rendered markdown, hidden thinking, word-wrapped diffs, global tabs. [docs](docs/cli-tui-settings.md)
- ⚙️ **Automatic karakuri** — a native plugin runs `karakuri digest` + `audit` after every file mutation, debounced and non-blocking. [docs](docs/karakuri-auto.md)
- 📚 **Rules & skills** — bootstrapped from the separate `karakuri` repo and synced across agent runtimes, so there is one source and no drift.
- 🔐 **Secret-free by default** — templated provider values, `.env`-driven render, `0600` on the rendered config.
- 🔁 **Two-way capture** — `update.sh` snapshots live local edits back into the repo.

---

## 📂 Layout

| Path | Purpose |
|---|---|
| `install.sh` | Restore this setup onto a machine. |
| `update.sh` | Capture the current machine's live config back into the repo. |
| `config/opencode.json.tmpl` | Provider, models, compaction, plugin wiring (templated). |
| `config/cli.json`, `config/tui.json`, `config/package.json` | Copied verbatim. |
| `bin/opencode2` | Launcher wrapper. |
| `plugins/karakuri/` | Auto-digest/audit OpenCode plugin. |
| `docs/` | Rationale for each customization. |
| `.env.example` | Template for local secrets. |

---

## 🔄 Workflow

```bash
# Fresh machine
./install.sh

# After changing things locally
./update.sh          # snapshot live config into the repo
git diff && git commit -am "tune compaction" && git push
```

Guard rails while installing:

| Env | Effect |
|---|---|
| `SKIP_KARAKURI=1` | Skip the karakuri rules/skills bootstrap. |
| `KARAKURI_AUTO=0` | Disable the auto-digest/audit plugin at runtime. |
| `KARAKURI_DEBOUNCE_MS=8000` | Widen the plugin debounce window. |

---

## 🚫 Deliberately not committed

`service.json`, `auth.json`, `.env`, `node_modules/`, runtime `*.db` files, and backups. See [`.gitignore`](.gitignore) and [docs](docs/karakuri-auto.md).

---

## 📜 License

MIT — see [LICENSE](LICENSE).
