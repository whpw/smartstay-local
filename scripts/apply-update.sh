#!/usr/bin/env bash
# Apply a downloaded smartstay-local release tarball and restart the service.
# Usage: apply-update.sh <archive.tar.gz> <install_root> <systemd_service> <version>
#
# The service unit is a *system* unit (User=smartstay). OTA runs as smartstay, so
# passwordless sudo for systemctl is required for clean stop/start, e.g.:
#   smartstay ALL=(root) NOPASSWD: /bin/systemctl stop smartstay, /bin/systemctl start smartstay, /bin/systemctl restart smartstay, /bin/systemctl is-active smartstay
# See scripts/smartstay-systemctl.sudoers.
set -euo pipefail

ARCHIVE="${1:?archive path required}"
INSTALL_ROOT="${2:?install root required}"
SERVICE_NAME="${3:-smartstay}"
VERSION="${4:-unknown}"
PNPM_TIMEOUT_SEC="${PNPM_TIMEOUT_SEC:-600}"
APP_PORT="${APP_PORT:-8080}"
HEALTH_TIMEOUT_SEC="${HEALTH_TIMEOUT_SEC:-60}"
# Durable state lives beside the install tree (not under it), matching backend
# ../../appdata from cwd=backend → /home/smartstay/appdata.
APPDATA_DIR="${APPDATA_DIR:-$(cd "$(dirname "$INSTALL_ROOT")" && pwd)/appdata}"
OTA_LOCK_FILE="${OTA_LOCK_FILE:-$APPDATA_DIR/ota.lock}"
OTA_RESULT_FILE="${OTA_RESULT_FILE:-$APPDATA_DIR/ota-result.json}"

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

write_result() {
  local ok="$1"
  local error="${2:-}"
  mkdir -p "$APPDATA_DIR" 2>/dev/null || true
  OK="$ok" VER="$VERSION" ERR="$error" OUT="$OTA_RESULT_FILE" node -e '
    const fs = require("fs");
    const payload = {
      ok: process.env.OK === "true",
      version: process.env.VER || "unknown",
      finishedAt: Date.now(),
    };
    if (!payload.ok) payload.error = String(process.env.ERR || "").slice(0, 1024);
    fs.writeFileSync(process.env.OUT, JSON.stringify(payload) + "\n");
  ' 2>/dev/null || true
}

release_lock() {
  rm -f "$OTA_LOCK_FILE" 2>/dev/null || true
}

# Try passwordless sudo first (system unit), then systemctl, then --user.
# Captures stderr so auth / unit errors show up in ota-apply.log + journal.
try_systemctl() {
  local verb="$1"
  local output=""
  local ec=0

  if command -v sudo >/dev/null 2>&1; then
    set +e
    output="$(sudo -n systemctl "$verb" "$SERVICE_NAME" 2>&1)"
    ec=$?
    set -e
    if [[ $ec -eq 0 ]]; then
      log "systemctl $verb succeeded (sudo -n)"
      return 0
    fi
    log "sudo -n systemctl $verb failed (exit $ec): ${output:-<no output>}"
  fi

  set +e
  output="$(systemctl "$verb" "$SERVICE_NAME" 2>&1)"
  ec=$?
  set -e
  if [[ $ec -eq 0 ]]; then
    log "systemctl $verb succeeded (system)"
    return 0
  fi
  log "systemctl $verb failed (exit $ec): ${output:-<no output>}"

  set +e
  output="$(systemctl --user "$verb" "$SERVICE_NAME" 2>&1)"
  ec=$?
  set -e
  if [[ $ec -eq 0 ]]; then
    log "systemctl $verb succeeded (user)"
    return 0
  fi
  log "systemctl --user $verb failed (exit $ec): ${output:-<no output>}"
  return 1
}

free_app_port() {
  if ! command -v fuser >/dev/null 2>&1; then
    return 0
  fi
  if fuser "${APP_PORT}/tcp" >/dev/null 2>&1; then
    log "Freeing port ${APP_PORT} before continuing"
    fuser -k "${APP_PORT}/tcp" >/dev/null 2>&1 || true
    sleep 2
  fi
}

if [[ ! -f "$ARCHIVE" ]]; then
  log "Archive not found: $ARCHIVE"
  write_result false "Archive not found: $ARCHIVE"
  exit 1
fi

mkdir -p "$APPDATA_DIR" 2>/dev/null || true
# Prevent systemd Restart= from bringing the app back while we replace files
# (important when systemctl stop is unavailable without sudoers).
printf '%s\n' "$VERSION" >"$OTA_LOCK_FILE"
trap 'release_lock' EXIT

# Let the parent Node process finish its "applying" heartbeat, then stop the
# service so node_modules / dist files are not locked during install.
sleep 2

stop_service() {
  if ! command -v systemctl >/dev/null 2>&1; then
    log "systemctl not available; freeing port ${APP_PORT}"
    free_app_port
    return 0
  fi
  log "Stopping $SERVICE_NAME before applying files"
  if ! try_systemctl stop; then
    log "WARN: cannot systemctl stop $SERVICE_NAME — install passwordless sudo for OTA:"
    log "  sudo cp $INSTALL_ROOT/scripts/smartstay-systemctl.sudoers /etc/sudoers.d/smartstay-systemctl && sudo chmod 440 /etc/sudoers.d/smartstay-systemctl"
    log "Freeing port ${APP_PORT} as fallback (may race if Restart= is enabled on the unit)"
  fi
  # Clear listeners left by older npm/pnpm wrapper layouts (KillMode=process).
  free_app_port
  sleep 1
}

start_service() {
  free_app_port
  # Allow start.sh / systemd to proceed past the OTA lock.
  release_lock

  if command -v systemctl >/dev/null 2>&1; then
    log "Starting $SERVICE_NAME"
    if try_systemctl start; then
      return 0
    fi
    log "systemctl start failed; attempting start.sh (process will be outside systemd until next manual restart)"
  else
    log "systemctl not available; attempting start.sh"
  fi

  nohup bash "$INSTALL_ROOT/start.sh" >/tmp/smartstay-restart.log 2>&1 &
  log "Spawned start.sh via nohup (pid $!); log=/tmp/smartstay-restart.log"
}

wait_for_version() {
  local expected="$1"
  local url="http://127.0.0.1:${APP_PORT}/api/info"
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SEC))
  local body=""
  local got=""

  log "Waiting up to ${HEALTH_TIMEOUT_SEC}s for /api/info version=${expected}"
  while (( SECONDS < deadline )); do
    set +e
    if command -v curl >/dev/null 2>&1; then
      body="$(curl -fsS --max-time 2 "$url" 2>/dev/null)"
    elif command -v wget >/dev/null 2>&1; then
      body="$(wget -q -O - -T 2 "$url" 2>/dev/null)"
    else
      body="$(node -e "fetch(process.argv[1]).then(r=>r.text()).then(t=>{process.stdout.write(t);process.exit(0)}).catch(()=>process.exit(1))" "$url" 2>/dev/null)"
    fi
    set -e
    if [[ -n "${body:-}" ]]; then
      got="$(printf '%s' "$body" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const j=JSON.parse(s);process.stdout.write(String(j.version||''))}catch{process.exit(2)}})" 2>/dev/null || true)"
      if [[ "$got" == "$expected" ]]; then
        log "Health check ok — running version=${got}"
        return 0
      fi
      log "Health check: got version=${got:-<none>} (want ${expected})"
    fi
    sleep 2
  done
  return 1
}

stop_service

WORKDIR="$(mktemp -d /tmp/smartstay-apply-XXXXXX)"
cleanup_workdir() {
  rm -rf "$WORKDIR"
}
trap 'cleanup_workdir; release_lock' EXIT

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
  write_result false "Invalid archive: package.json missing"
  exit 1
fi

log "Syncing files into $INSTALL_ROOT (appdata=$APPDATA_DIR)"
# Appdata is outside INSTALL_ROOT in production; exclude is a safety net if a
# stray appdata/ ever appears under the install tree. Keep node_modules for
# prefer-offline / incremental installs.
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
  write_result false "Neither pnpm nor npm available"
  exit 1
fi

rm -f "$APPDATA_DIR/pending-update.json" 2>/dev/null || true
# Legacy path from older OTA builds
rm -f "$INSTALL_ROOT/appdata/pending-update.json" 2>/dev/null || true

start_service

if wait_for_version "$VERSION"; then
  write_result true
  log "Update to $VERSION applied"
else
  write_result false "Service did not report version ${VERSION} on :${APP_PORT}/api/info within ${HEALTH_TIMEOUT_SEC}s"
  log "ERROR: update to $VERSION did not come online (still wrong/old process or start failed)"
  exit 1
fi
