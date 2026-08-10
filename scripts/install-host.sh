#!/usr/bin/env bash
# One-time DietPi host bootstrap for smartstay-local.
#
# Installs system Node (no nvm), sudoers for OTA, the systemd unit, and
# optionally bootstraps the first release into releases/<ver> + current.
#
# Usage (as root):
#   ./scripts/install-host.sh [/path/to/smartstay-local-<ver>.tar.gz]
#
# Prerequisites:
#   - user `smartstay` exists with home /home/smartstay
#   - /home/smartstay/appdata/.env is configured
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root (sudo)" >&2
  exit 1
fi

SMARTSTAY_USER="${SMARTSTAY_USER:-smartstay}"
SMARTSTAY_HOME="${SMARTSTAY_HOME:-/home/smartstay/smartstay-local}"
APPDATA_DIR="${APPDATA_DIR:-/home/smartstay/appdata}"
NODE_BIN="${NODE_BIN:-/usr/local/bin/node}"
ARCHIVE="${1:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$REPO_ROOT/.nvmrc" ]]; then
  NODE_VERSION="$(tr -d '[:space:]' <"$REPO_ROOT/.nvmrc")"
else
  NODE_VERSION="v24.10.0"
fi
# node-install.sh wants a leading v
[[ "$NODE_VERSION" == v* ]] || NODE_VERSION="v${NODE_VERSION}"

log() { echo "[install-host] $*"; }

if ! id "$SMARTSTAY_USER" >/dev/null 2>&1; then
  echo "User $SMARTSTAY_USER does not exist" >&2
  exit 1
fi

mkdir -p "$APPDATA_DIR" "$SMARTSTAY_HOME/releases"
chown -R "$SMARTSTAY_USER:$SMARTSTAY_USER" "$APPDATA_DIR" "$SMARTSTAY_HOME"

# --- System Node (DietPi / MichaIng installer) ---
if [[ -x "$NODE_BIN" ]]; then
  log "Node already present: $($NODE_BIN -v) ($NODE_BIN)"
else
  log "Installing Node ${NODE_VERSION} via MichaIng nodejs-linux-installer…"
  TMP="$(mktemp -d /tmp/smartstay-node-XXXXXX)"
  trap 'rm -rf "$TMP"' EXIT
  curl -fsSL \
    "https://raw.githubusercontent.com/MichaIng/nodejs-linux-installer/master/node-install.sh" \
    -o "$TMP/node-install.sh"
  chmod +x "$TMP/node-install.sh"
  "$TMP/node-install.sh" -v "$NODE_VERSION"
  trap - EXIT
  rm -rf "$TMP"
fi

if [[ ! -x "$NODE_BIN" ]]; then
  # Some installs put node only on PATH
  if command -v node >/dev/null 2>&1; then
    NODE_BIN="$(command -v node)"
    log "Using node from PATH: $NODE_BIN ($($NODE_BIN -v))"
  else
    echo "Node binary not found at /usr/local/bin/node after install" >&2
    exit 1
  fi
fi

# Remove nvm for the smartstay user if present
NVM_DIR="$(eval echo "~$SMARTSTAY_USER/.nvm")"
if [[ -d "$NVM_DIR" ]]; then
  log "Removing nvm at $NVM_DIR"
  rm -rf "$NVM_DIR"
fi

# --- sudoers for OTA systemctl ---
SUDOERS_SRC="$SCRIPT_DIR/smartstay-systemctl.sudoers"
if [[ -f "$SUDOERS_SRC" ]]; then
  log "Installing sudoers drop-in"
  cp "$SUDOERS_SRC" /etc/sudoers.d/smartstay-systemctl
  chmod 440 /etc/sudoers.d/smartstay-systemctl
  if command -v visudo >/dev/null 2>&1; then
    visudo -cf /etc/sudoers.d/smartstay-systemctl >/dev/null
  fi
fi

# --- Bootstrap first release if archive provided or repo looks like a release ---
bootstrap_from_dir() {
  local src="$1"
  local version
  version="$(node -p "require('${src}/package.json').version" 2>/dev/null || true)"
  if [[ -z "${version:-}" || "$version" == "undefined" ]]; then
    echo "Cannot read version from $src/package.json" >&2
    return 1
  fi
  if [[ ! -f "$src/backend/dist/index.js" ]]; then
    echo "Missing $src/backend/dist/index.js — pack/build a release first" >&2
    return 1
  fi
  local target="$SMARTSTAY_HOME/releases/$version"
  log "Bootstrapping release $version → $target"
  rm -rf "$target"
  mkdir -p "$target"
  cp -a "$src/." "$target/"
  # Drop junk that should not live in a release tree if copying from a git checkout
  rm -rf "$target/.git" "$target/node_modules" "$target/backend/node_modules" \
    "$target/frontend/node_modules" "$target/frontend/src" "$target/backend/src" \
    "$target/dist-release" 2>/dev/null || true
  chmod +x "$target/scripts/"*.sh 2>/dev/null || true
  ln -sfn "releases/$version" "$SMARTSTAY_HOME/current"
  chown -R "$SMARTSTAY_USER:$SMARTSTAY_USER" "$SMARTSTAY_HOME"
  log "current → $(readlink "$SMARTSTAY_HOME/current")"
}

if [[ -n "$ARCHIVE" ]]; then
  if [[ ! -f "$ARCHIVE" ]]; then
    echo "Archive not found: $ARCHIVE" >&2
    exit 1
  fi
  STAGE="$(mktemp -d /tmp/smartstay-bootstrap-XXXXXX)"
  tar -xzf "$ARCHIVE" -C "$STAGE"
  SRC="$STAGE"
  if [[ "$(find "$STAGE" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1 ]]; then
    ONLY="$(find "$STAGE" -mindepth 1 -maxdepth 1 -type d | head -n 1 || true)"
    [[ -n "${ONLY:-}" ]] && SRC="$ONLY"
  fi
  bootstrap_from_dir "$SRC"
  rm -rf "$STAGE"
elif [[ ! -L "$SMARTSTAY_HOME/current" && -f "$REPO_ROOT/backend/dist/index.js" ]]; then
  log "No archive given; bootstrapping from repo dist at $REPO_ROOT"
  bootstrap_from_dir "$REPO_ROOT"
elif [[ -L "$SMARTSTAY_HOME/current" ]]; then
  log "current already set: $(readlink "$SMARTSTAY_HOME/current")"
else
  log "WARN: no release bootstrapped — pass a release tarball or build dist first"
fi

# --- systemd unit ---
UNIT_SRC="$SCRIPT_DIR/smartstay.service"
if [[ -f "$SMARTSTAY_HOME/current/scripts/smartstay.service" ]]; then
  UNIT_SRC="$SMARTSTAY_HOME/current/scripts/smartstay.service"
fi
if [[ -f "$UNIT_SRC" ]]; then
  log "Installing systemd unit from $UNIT_SRC"
  # If node is not at /usr/local/bin/node, rewrite ExecStart.
  if [[ "$NODE_BIN" != "/usr/local/bin/node" ]]; then
    sed "s|/usr/local/bin/node|$NODE_BIN|g" "$UNIT_SRC" >/etc/systemd/system/smartstay.service
  else
    cp "$UNIT_SRC" /etc/systemd/system/smartstay.service
  fi
  systemctl daemon-reload
  systemctl enable smartstay.service
  log "Enabled smartstay.service — start with: systemctl start smartstay"
else
  log "WARN: unit file not found"
fi

log "Done."
log "  Node:        $NODE_BIN ($($NODE_BIN -v))"
log "  Home:        $SMARTSTAY_HOME"
log "  Appdata:     $APPDATA_DIR"
log "  current:     $(readlink "$SMARTSTAY_HOME/current" 2>/dev/null || echo '<unset>')"
