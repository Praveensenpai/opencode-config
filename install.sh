#!/usr/bin/env bash
# ==============================================================================
#  🌸 opencode-config — one-line installer
#
#  Downloads the latest release binary and runs it.
#
#    curl -fsSL https://raw.githubusercontent.com/Praveensenpai/opencode-config/main/install.sh | bash
#
#  Flags pass through to the binary, e.g.:
#    curl -fsSL .../install.sh | bash -s -- version
# ==============================================================================
set -euo pipefail

REPO="Praveensenpai/opencode-config"
TARGET="x86_64-unknown-linux-gnu"
ASSET="opencode-config-${TARGET}.tar.gz"
URL="${OPENCODE_CONFIG_URL:-https://github.com/${REPO}/releases/latest/download/${ASSET}}"

log() { printf '\033[1;35m🌸\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31m✘\033[0m %s\n' "$*" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || die "curl is required"
command -v tar  >/dev/null 2>&1 || die "tar is required"

uname_s="$(uname -s)"
uname_m="$(uname -m)"
[[ "${uname_s}" == "Linux" && "${uname_m}" == "x86_64" ]] \
    || die "unsupported platform: ${uname_s}/${uname_m} (only Linux x86_64)"

tmp="$(mktemp -d -t opencode-config.XXXXXXXXXX)"
trap 'rm -rf "${tmp}"' EXIT INT TERM HUP

log "Fetching ${ASSET}..."
curl -fsSL "${URL}" -o "${tmp}/${ASSET}" || die "download failed: ${URL}"

tar -xzf "${tmp}/${ASSET}" -C "${tmp}" || die "extract failed"
bin="${tmp}/opencode-config"
[[ -f "${bin}" ]] || die "binary missing from archive"
chmod +x "${bin}"

if [[ $# -eq 0 ]]; then
    set -- install
fi
exec "${bin}" "$@"
