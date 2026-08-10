#!/usr/bin/env bash
# Apply a downloaded smartstay-local release tarball and restart the service.
# Usage: apply-update.sh <archive.tar.gz> <install_root> <systemd_service> <version>
set -euo pipefail

ARCHIVE="${1:?archive path required}"
INSTALL_ROOT="${2:?install root required}"
SERVICE_NAME="${3:-smartstay}"
VERSION="${4:-unknown}"

LOG_TAG="smartstay-ota"
log() {
  echo "[$LOG_TAG] $*" >&2
  if [[ -n "${OTA_LOG_FILE:-}" ]]; then
    mkdir -p "$(dirname "$OTA_LOG_FILE")" 2>/dev/null || true
    echo "[$LOG_TAG] $*" >>"$OTA_LOG_FILE" 2>/dev/null || true
  fi
  logger -t "$LOG_TAG" "$*" 2>/dev/null || true
}

if [[ ! -f "$ARCHIVE" ]]; then
  log "Archive not found: $ARCHIVE"
  exit 1
fi

# Give the Node process a moment to finish the heartbeat after spawning us.
sleep 3

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

if command -v pnpm >/dev/null 2>&1; then
  log "Running pnpm install --prod"
  pnpm install --prod --frozen-lockfile || pnpm install --prod
elif command -v npm >/dev/null 2>&1; then
  log "pnpm not found; running npm install --omit=dev"
  npm install --omit=dev
else
  log "Neither pnpm nor npm available"
  exit 1
fi

rm -f "$INSTALL_ROOT/appdata/pending-update.json" 2>/dev/null || true

log "Restarting systemd service: $SERVICE_NAME"
if command -v systemctl >/dev/null 2>&1; then
  # Prefer user-level restart if the unit is not system-wide.
  if systemctl restart "$SERVICE_NAME" 2>/dev/null; then
    log "Restarted $SERVICE_NAME (system)"
  elif systemctl --user restart "$SERVICE_NAME" 2>/dev/null; then
    log "Restarted $SERVICE_NAME (user)"
  else
    log "systemctl restart failed; attempting start.sh directly"
    nohup bash "$INSTALL_ROOT/start.sh" >/tmp/smartstay-restart.log 2>&1 &
  fi
else
  log "systemctl not available; start.sh will be used by the supervisor"
fi

log "Update to $VERSION applied"
