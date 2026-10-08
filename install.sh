#!/usr/bin/env bash
# ==============================================================================
#  🌸 opencode-config — Bootstrap Installer
#  Restores a customized OpenCode setup on a fresh machine.
# ==============================================================================

set -euo pipefail
IFS=$'\n\t'

KARAKURI_INSTALL_URL="https://raw.githubusercontent.com/Praveensenpai/karakuri/main/install.sh"

log_info() { printf '\033[1;35m🌸\033[0m %s\n' "$*" >&2; }
log_ok()   { printf '\033[1;32m✔\033[0m %s\n' "$*" >&2; }
log_warn() { printf '\033[1;33m⚠\033[0m %s\n' "$*" >&2; }
log_err()  { printf '\033[1;31m✘\033[0m %s\n' "$*" >&2; }

die() { log_err "$*"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/opencode"
OPENCODE_HOME="${OPENCODE_HOME:-$HOME/.opencode}"
BIN_DIR="${OPENCODE_HOME}/bin"

TEMP_DIR=""
cleanup() {
    if [[ -n "${TEMP_DIR}" && -d "${TEMP_DIR}" ]]; then
        rm -rf "${TEMP_DIR}"
    fi
}
trap cleanup EXIT INT TERM HUP

require_cmd() {
    command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

# ---------------------------------------------------------------- env loading
load_env() {
    if [[ -f "${SCRIPT_DIR}/.env" ]]; then
        # shellcheck disable=SC1091
        set -a; source "${SCRIPT_DIR}/.env"; set +a
        log_info "Loaded secrets from ${SCRIPT_DIR}/.env"
    fi
    : "${MOCHI_BASE_URL:=http://mochi:4000/v1}"
    : "${MOCHI_API_KEY:=}"
}

prompt_api_key() {
    if [[ -z "${MOCHI_API_KEY}" ]]; then
        if [[ -t 0 ]]; then
            read -r -p "Mochi API key (blank = leave placeholder): " MOCHI_API_KEY || true
        fi
        MOCHI_API_KEY="${MOCHI_API_KEY:-CHANGE_ME}"
    fi
}

# ---------------------------------------------------------------- templating
render_config() {
    local tpl="${SCRIPT_DIR}/config/opencode.json.tmpl"
    local out="$1"
    [[ -f "${tpl}" ]] || die "Missing template: ${tpl}"
    sed -e "s|__MOCHI_BASE_URL__|${MOCHI_BASE_URL}|g" \
        -e "s|__MOCHI_API_KEY__|${MOCHI_API_KEY}|g" \
        "${tpl}" > "${out}"
}

# ---------------------------------------------------------------- installers
install_configs() {
    mkdir -p "${CONFIG_DIR}"
    TEMP_DIR="$(mktemp -d -t opencode-config.XXXXXXXXXX)"

    log_info "Rendering opencode.json → ${CONFIG_DIR}/opencode.json"
    render_config "${TEMP_DIR}/opencode.json"
    install -m 600 "${TEMP_DIR}/opencode.json" "${CONFIG_DIR}/opencode.json"

    local f
    for f in cli.json tui.json package.json; do
        if [[ -f "${SCRIPT_DIR}/config/${f}" ]]; then
            install -m 644 "${SCRIPT_DIR}/config/${f}" "${CONFIG_DIR}/${f}"
            log_ok "Installed ${f}"
        fi
    done
}

install_plugin() {
    local src="${SCRIPT_DIR}/plugins/karakuri"
    local dest="${CONFIG_DIR}/plugins/karakuri"
    if [[ ! -d "${src}" ]]; then
        log_warn "No plugin payload at ${src}; skipping"
        return
    fi
    mkdir -p "${dest}"
    install -m 644 "${src}/plugin.js" "${dest}/plugin.js"
    install -m 644 "${src}/package.json" "${dest}/package.json"
    log_ok "Installed karakuri plugin → ${dest}"
}

install_wrapper() {
    mkdir -p "${BIN_DIR}"
    if [[ -f "${SCRIPT_DIR}/bin/opencode2" ]]; then
        install -m 755 "${SCRIPT_DIR}/bin/opencode2" "${BIN_DIR}/opencode2"
        log_ok "Installed wrapper → ${BIN_DIR}/opencode2"
    fi
}

install_deps() {
    [[ -f "${CONFIG_DIR}/package.json" ]] || return 0
    if command -v bun >/dev/null 2>&1; then
        (cd "${CONFIG_DIR}" && bun install --silent) && log_ok "Installed plugin deps (bun)"
    elif command -v npm >/dev/null 2>&1; then
        (cd "${CONFIG_DIR}" && npm install --silent) && log_ok "Installed plugin deps (npm)"
    else
        log_warn "Neither bun nor npm found; skipping plugin dependency install"
    fi
}

bootstrap_karakuri() {
    if [[ "${SKIP_KARAKURI:-0}" == "1" ]]; then
        log_warn "Skipping karakuri bootstrap (SKIP_KARAKURI=1)"
        return
    fi
    if command -v karakuri >/dev/null 2>&1; then
        log_info "karakuri present; syncing skills across agents..."
        karakuri sync || log_warn "karakuri sync failed"
        return
    fi
    if command -v curl >/dev/null 2>&1; then
        log_info "Bootstrapping karakuri (rules + skills)..."
        curl -fsSL "${KARAKURI_INSTALL_URL}" | bash -s -- install --global --all -y \
            || log_warn "karakuri bootstrap failed"
    else
        log_warn "curl not found; skipping karakuri bootstrap"
    fi
}

main() {
    log_info "opencode-config installer"
    require_cmd sed
    require_cmd install
    load_env
    prompt_api_key
    install_configs
    install_plugin
    install_wrapper
    install_deps
    bootstrap_karakuri

    log_ok "Done. Restart OpenCode to load the new configuration."
    if [[ "${MOCHI_API_KEY}" == "CHANGE_ME" ]]; then
        log_warn "Mochi API key left as placeholder — edit ${CONFIG_DIR}/opencode.json"
    fi
}

main "$@"