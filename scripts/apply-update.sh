#!/usr/bin/env bash
# Apply a downloaded smartstay-local release tarball and restart the service.
# Usage: apply-update.sh <archive.tar.gz> <install_root> <systemd_service> <version>
set -euo pipefail

ARCHIVE="${1:?archive path required}"
INSTALL_ROOT="${2:?install root required}"
SERVICE_NAME="${3:-smartstay}"
VERSION="${4:-unknown}"
PNPM_TIMEOUT_SEC="${PNPM_TIMEOUT_SEC:-600}"

LOG_TAG="smartstay-ota"
log() {
  echo "[$LOG_TAG] $*" >&2
  if [[ -n "${OTA_LOG_FILE:-}" ]]; then
    mkdir -p "$(dirname "$OTA_LOG_FILE")" 2>/dev/null || true
    echo "[$LOG_TAG] $*" >>"$OTA_LOG_FILE" 2>/dev/null || true
  fi
  logger -t "$LOG_TAG" "$*" 2>/dev/null || true
}

run_logged() {
  # Stream command output into the OTA log (and journal via stdout/stderr).
  if [[ -n "${OTA_LOG_FILE:-}" ]]; then
    "$@" >>"$OTA_LOG_FILE" 2>&1
  else
    "$@"
  fi
}

if [[ ! -f "$ARCHIVE" ]]; then
  log "Archive not found: $ARCHIVE"
  exit 1
fi

# Let the parent Node process finish its "applying" heartbeat, then stop the
# service so node_modules / dist files are not locked during install.
sleep 2

stop_service() {
  if ! command -v systemctl >/dev/null 2>&1; then
    return 0
  fi
  log "Stopping $SERVICE_NAME before applying files"
  if systemctl stop "$SERVICE_NAME" 2>/dev/null; then
    log "Stopped $SERVICE_NAME (system)"
  elif systemctl --user stop "$SERVICE_NAME" 2>/dev/null; then
    log "Stopped $SERVICE_NAME (user)"
  else
    log "Could not systemctl stop $SERVICE_NAME (continuing)"
  fi
  # Give Node a moment to release file locks.
  sleep 2
}

start_service() {
  if ! command -v systemctl >/dev/null 2>&1; then
    log "systemctl not available; attempting start.sh"
    nohup bash "$INSTALL_ROOT/start.sh" >/tmp/smartstay-restart.log 2>&1 &
    return 0
  fi
  log "Starting $SERVICE_NAME"
  if systemctl start "$SERVICE_NAME" 2>/dev/null; then
    log "Started $SERVICE_NAME (system)"
  elif systemctl --user start "$SERVICE_NAME" 2>/dev/null; then
    log "Started $SERVICE_NAME (user)"
  else
    log "systemctl start failed; attempting start.sh"
    nohup bash "$INSTALL_ROOT/start.sh" >/tmp/smartstay-restart.log 2>&1 &
  fi
}

stop_service

WORKDIR="$(mktemp -d /tmp/smartstay-apply-XXXXXX)"
cleanup() {
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

log "Extracting $ARCHIVE (version $VERSION) into $WORKDIR"
tar -xzf "$ARCHIVE" -C "$WORKDIR"

# Support archives with a single top-level directory or flat layout.
SRC="$WORKDIR"
if [[ "$(find "$WORKDIR" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1 ]]; then
  ONLY="$(find "$WORKDIR" -mindepth 1 -maxdepth 1 -type d | head -n 1 || true)"
  if [[ -n "${ONLY:-}" ]]; then
    SRC="$ONLY"
  fi
fi

if [[ ! -f "$SRC/package.json" ]]; then
  log "Invalid archive: package.json missing"
  exit 1
fi

log "Syncing files into $INSTALL_ROOT"
# Preserve appdata and local env; replace app code.
# Keep existing node_modules so install can be prefer-offline / incremental.
rsync -a \
  --delete \
  --exclude 'appdata/' \
  --exclude 'node_modules/' \
  --exclude 'backend/node_modules/' \
  --exclude 'frontend/node_modules/' \
  --exclude '.git/' \
  --exclude '.wrangler/' \
  "$SRC/" "$INSTALL_ROOT/"

cd "$INSTALL_ROOT"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"

# Non-interactive; room devices often have weak/captive networks.
export CI=true
export npm_config_yes=true

if command -v pnpm >/dev/null 2>&1; then
  log "Running pnpm install --prod (timeout ${PNPM_TIMEOUT_SEC}s)"
  if command -v timeout >/dev/null 2>&1; then
    run_logged timeout "$PNPM_TIMEOUT_SEC" pnpm install --prod --frozen-lockfile --prefer-offline \
      || run_logged timeout "$PNPM_TIMEOUT_SEC" pnpm install --prod --prefer-offline
  else
    run_logged pnpm install --prod --frozen-lockfile --prefer-offline \
      || run_logged pnpm install --prod --prefer-offline
  fi
elif command -v npm >/dev/null 2>&1; then
  log "pnpm not found; running npm install --omit=dev"
  if command -v timeout >/dev/null 2>&1; then
    run_logged timeout "$PNPM_TIMEOUT_SEC" npm install --omit=dev --no-fund --no-audit
  else
    run_logged npm install --omit=dev --no-fund --no-audit
  fi
else
  log "Neither pnpm nor npm available"
  exit 1
fi

rm -f "$INSTALL_ROOT/appdata/pending-update.json" 2>/dev/null || true

start_service

log "Update to $VERSION applied"
