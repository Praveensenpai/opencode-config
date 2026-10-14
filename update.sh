#!/usr/bin/env bash
# ==============================================================================
#  🌸 opencode-config — Capture
#  Snapshots the live OpenCode config on this machine back into the repo.
# ==============================================================================

set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
OPENCODE_HOME="${OPENCODE_HOME:-$HOME/.opencode}"

log_info() { printf '\033[1;35m🌸\033[0m %s\n' "$*" >&2; }
log_ok()   { printf '\033[1;32m✔\033[0m %s\n' "$*" >&2; }

load_env() {
    if [[ -f "${SCRIPT_DIR}/.env" ]]; then
        # shellcheck disable=SC1091
        set -a; source "${SCRIPT_DIR}/.env"; set +a
    fi
    : "${MOCHI_BASE_URL:=http://mochi:4000/v1}"
    : "${MOCHI_API_KEY:=}"
}

capture_config() {
    local src="${CONFIG_DIR}/opencode.json"
    if [[ ! -f "${src}" ]]; then
        log_info "No live opencode.json; skipping"
        return
    fi
    local sed_args=(-e "s|${MOCHI_BASE_URL}|__MOCHI_BASE_URL__|g")
    if [[ -n "${MOCHI_API_KEY}" ]]; then
        sed_args+=(-e "s|${MOCHI_API_KEY}|__MOCHI_API_KEY__|g")
    fi
    sed "${sed_args[@]}" "${src}" > "${SCRIPT_DIR}/config/opencode.json.tmpl"
    log_ok "Captured opencode.json → config/opencode.json.tmpl"
}

capture_static() {
    local f
    for f in cli.json tui.json package.json; do
        if [[ -f "${CONFIG_DIR}/${f}" ]]; then
            install -m 644 "${CONFIG_DIR}/${f}" "${SCRIPT_DIR}/config/${f}"
            log_ok "Captured ${f}"
        fi
    done
    if [[ -f "${OPENCODE_HOME}/bin/opencode2" ]]; then
        install -m 755 "${OPENCODE_HOME}/bin/opencode2" "${SCRIPT_DIR}/bin/opencode2"
        log_ok "Captured opencode2 wrapper"
    fi
}

capture_interval_ping() {
    local src="${CONFIG_DIR}/interval-ping"
    if [[ ! -d "${src}" ]]; then
        log_info "No live interval-ping plugin; skipping"
        return
    fi
    mkdir -p "${SCRIPT_DIR}/plugins/interval-ping"
    local f
    for f in index.js rpc.js tui.tsx package.json; do
        if [[ -f "${src}/${f}" ]]; then
            install -m 644 "${src}/${f}" "${SCRIPT_DIR}/plugins/interval-ping/${f}"
            log_ok "Captured interval-ping/${f}"
        fi
    done
}

capture_background_tasks() {
    local src="${CONFIG_DIR}/background-tasks"
    if [[ ! -d "${src}" ]]; then
        log_info "No live background-tasks plugin; skipping"
        return
    fi
    mkdir -p "${SCRIPT_DIR}/plugins/background-tasks"
    local f
    for f in index.js tui.tsx package.json; do
        if [[ -f "${src}/${f}" ]]; then
            install -m 644 "${src}/${f}" "${SCRIPT_DIR}/plugins/background-tasks/${f}"
            log_ok "Captured background-tasks/${f}"
        fi
    done
}

load_env
capture_static
capture_interval_ping
capture_background_tasks
capture_config
log_ok "Review changes: git -C \"${SCRIPT_DIR}\" diff"
