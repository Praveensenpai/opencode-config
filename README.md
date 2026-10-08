<div align="center">

# 🌸 設定 — OpenCode Config

**A single Rust binary that rebuilds my entire OpenCode setup on any machine — provider, models, TUI ergonomics, and automatic karakuri enforcement.**

[![Public](https://img.shields.io/badge/repo-public-3FB950?style=flat-square&logo=github)](https://github.com/Praveensenpai/opencode-config)
[![Release](https://img.shields.io/github/v/release/Praveensenpai/opencode-config?style=flat-square&color=7C3AED)](https://github.com/Praveensenpai/opencode-config/releases)
[![Rust](https://img.shields.io/badge/rust-1.97-000000?style=flat-square&logo=rust&logoColor=white)](#-why-rust)
[![Platform](https://img.shields.io/badge/platform-linux%20x86__64-1793D1?style=flat-square&logo=linux&logoColor=white)](#)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](#-license)

</div>

---

## 🎯 Why this exists

My OpenCode setup is not stock. It runs a local OpenAI-compatible proxy, ships five model variants, hides the default provider, tunes compaction, and layers in a rules-and-skills system. None of that is reproducible from memory, and the one file holding a secret must never be committed.

This repo is the source of truth. One command on a new machine brings the whole environment back — secrets rendered from environment variables or an interactive prompt, never from git.

> **Threat model:** the committed config is secret-free by construction. Real values are injected at install time, and the rendered `opencode.json` is written with `0600`.

---

## 🪄 One-Liner Magic

```bash
curl -fsSL https://raw.githubusercontent.com/Praveensenpai/opencode-config/main/install.sh | bash
```

That fetches the latest release binary, verifies the platform, and runs the installer. Pass through a subcommand with `bash -s --`:

```bash
curl -fsSL https://raw.githubusercontent.com/Praveensenpai/opencode-config/main/install.sh | bash -s -- version
```

---

## 🧭 What it restores

```text
        ┌──────────────────────────────────────────────┐
        │ GitHub Release  ·  Linux x86_64              │
        │ opencode-config-x86_64-unknown-linux-gnu     │
        └───────────────────────┬──────────────────────┘
                                │  curl | bash
                                ▼
        ┌──────────────────────────────────────────────┐
        │ install.sh  (~30 lines)                      │
        │ download → extract → exec the binary         │
        └──────────────────────────────────────────────┘
                                │
                                ▼
        ┌──────────────────────────────────────────────┐
        │ opencode-config  ·  single Rust binary, 355K │
        │   ┌──────────────────────────────────────┐   │
        │   │ embedded assets  (include_str!)      │   │
        │   │ • opencode.json template             │   │
        │   │ • cli.json · tui.json · package.json │   │
        │   │ • karakuri/plugin.js                 │   │
        │   │ • bin/opencode2 wrapper              │   │
        │   └──────────────────────────────────────┘   │
        └───────────────────────┬──────────────────────┘
                                │  render secrets · write files
                                ▼
        ┌──────────────────────────────────────────────┐
        │ ~/.config/opencode/opencode.json       (600) │
        │ ~/.config/opencode/cli.json · tui.json       │
        │ ~/.config/opencode/package.json              │
        │ ~/.config/opencode/plugins/karakuri/         │
        │ ~/.opencode/bin/opencode2              (755) │
        │ karakuri → rules + skills bootstrap + sync   │
        └──────────────────────────────────────────────┘
```

---

## 🦀 Why Rust

One static binary, no runtime dependencies, no payload fetch, no `git` required. Every config file, the plugin, and the wrapper are compiled in via `include_str!`, so the installer is a single self-contained artifact.

Built with **zero external crates** — pure `std`. That keeps the build offline-capable and the binary tiny. Quality gate is strict:

```bash
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --all-targets
```

---

## ✨ Feature matrix

- 🔌 **Mochi provider** — routes OpenCode through a local `deeperseeker-rs` proxy over the OpenAI-compatible API. [docs](docs/provider-mochi.md)
- 🧠 **Five model variants** — Flash, Deep Think, Web Search, Think+Search, and a Claude-compatible endpoint, all first-class picker entries. [docs](docs/models.md)
- 🧮 **Tuned compaction** — reserves 64k of a 128k window so deep-think traces never truncate mid-task. [docs](docs/compaction.md)
- 🖥️ **CLI & TUI ergonomics** — auto-accept permissions, rendered markdown, hidden thinking, word-wrapped diffs, global tabs. [docs](docs/cli-tui-settings.md)
- ⚙️ **Automatic karakuri** — a native plugin runs `karakuri digest` + `audit` after every file mutation, debounced and non-blocking. [docs](docs/karakuri-auto.md)
- 📚 **Rules & skills** — bootstrapped from the separate `karakuri` repo and synced across agent runtimes, so there is one source and no drift.
- 🔐 **Secret-free by default** — templated provider values, env-driven render, `0600` on the rendered config.
- 🔁 **Two-way capture** — `update.sh` snapshots live local edits back into the repo.

---

## 📂 Layout

| Path | Purpose |
|---|---|
| `install.sh` | One-line bootstrap: fetch release tarball, run the binary. |
| `src/` | Rust installer — `domain/` (pure), `infra/` (IO), `cli/` (args). |
| `Cargo.toml` | Zero-dependency crate manifest. |
| `update.sh` | Capture the current machine's live config back into the repo. |
| `config/opencode.json.tmpl` | Provider, models, compaction, plugin wiring (templated + embedded). |
| `config/cli.json`, `config/tui.json`, `config/package.json` | Copied verbatim (embedded). |
| `bin/opencode2` | Launcher wrapper (embedded). |
| `plugins/karakuri/` | Auto-digest/audit OpenCode plugin (embedded). |
| `docs/` | Rationale for each customization. |
| `.github/workflows/release.yml` | Builds + publishes the Linux x86_64 tarball on `v*` tags. |

---

## 🔄 Workflow

```bash
# Fresh machine
curl -fsSL https://raw.githubusercontent.com/Praveensenpai/opencode-config/main/install.sh | bash

# Build from source instead
cargo build --release && ./target/release/opencode-config install

# After changing things locally
./update.sh          # snapshot live config into the repo
git diff && git commit -am "tune compaction" && git push
```

Cut a release (CI builds + uploads the tarball automatically):

```bash
git tag v0.1.0 && git push origin v0.1.0
```

---

## 🛡️ Guard rails

| Env | Effect |
|---|---|
| `MOCHI_BASE_URL` | Provider base URL (default `http://mochi:4000/v1`). |
| `MOCHI_API_KEY` | Provider API key; prompts when unset and TTY-attached. |
| `SKIP_KARAKURI=1` | Skip the karakuri rules/skills bootstrap. |
| `KARAKURI_AUTO=0` | Disable the auto-digest/audit plugin at runtime. |
| `KARAKURI_DEBOUNCE_MS=8000` | Widen the plugin debounce window. |

---

## 🚫 Deliberately not committed

`service.json`, `auth.json`, `.env`, `node_modules/`, `/target/`, runtime `*.db` files, and backups. See [`.gitignore`](.gitignore).

---

## 📜 License

MIT — see [LICENSE](LICENSE).
