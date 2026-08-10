#!/usr/bin/env bash
# Apply a downloaded smartstay-local release tarball into releases/<version>
# and atomically flip the `current` symlink, then restart the service.
#
# Usage: apply-update.sh <archive.tar.gz> <smartstay_home> <systemd_service> <version>
#
# Layout:
#   $SMARTSTAY_HOME/current -> releases/<version>
#   $SMARTSTAY_HOME/releases/<version>/...
#   $(dirname $SMARTSTAY_HOME)/appdata/   durable state
#
# The service unit is a *system* unit (User=smartstay). OTA runs as smartstay, so
# passwordless sudo for systemctl is required:
#   See scripts/smartstay-systemctl.sudoers.
set -euo pipefail

ARCHIVE="${1:?archive path required}"
SMARTSTAY_HOME="${2:?smartstay home required}"
SERVICE_NAME="${3:-smartstay}"
VERSION="${4:-unknown}"
APP_PORT="${APP_PORT:-8080}"
HEALTH_TIMEOUT_SEC="${HEALTH_TIMEOUT_SEC:-60}"
KEEP_RELEASES="${KEEP_RELEASES:-2}"

# Durable state beside SMARTSTAY_HOME (not under releases/).
APPDATA_DIR="${APPDATA_DIR:-$(cd "$(dirname "$SMARTSTAY_HOME")" && pwd)/appdata}"
OTA_LOCK_FILE="${OTA_LOCK_FILE:-$APPDATA_DIR/ota.lock}"
OTA_RESULT_FILE="${OTA_RESULT_FILE:-$APPDATA_DIR/ota-result.json}"
RELEASES_DIR="$SMARTSTAY_HOME/releases"
TARGET_DIR="$RELEASES_DIR/$VERSION"
CURRENT_LINK="$SMARTSTAY_HOME/current"

LOG_TAG="smartstay-ota"
log() {
  echo "[$LOG_TAG] $*" >&2
  if [[ -n "${OTA_LOG_FILE:-}" ]]; then
    mkdir -p "$(dirname "$OTA_LOG_FILE")" 2>/dev/null || true
    echo "[$LOG_TAG] $*" >>"$OTA_LOG_FILE" 2>/dev/null || true
  fi
  logger -t "$LOG_TAG" "$*" 2>/dev/null || true
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

fail() {
  local msg="$1"
  log "ERROR: $msg"
  write_result false "$msg"
  exit 1
}

# Try passwordless sudo first (system unit), then systemctl, then --user.
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

atomic_symlink() {
  local target="$1"
  local linkpath="$2"
  local tmp="${linkpath}.new.$$"
  ln -sfn "$target" "$tmp"
  mv -Tf "$tmp" "$linkpath"
}

prune_releases() {
  local keep="$KEEP_RELEASES"
  [[ -d "$RELEASES_DIR" ]] || return 0

  # Prefer version-sort when available; fall back to mtime.
  local entries=()
  if ls -1 "$RELEASES_DIR" >/dev/null 2>&1; then
    mapfile -t entries < <(ls -1 "$RELEASES_DIR" | sort -V -r)
  fi
  if ((${#entries[@]} <= keep)); then
    return 0
  fi

  local i
  for ((i = keep; i < ${#entries[@]}; i++)); do
    local name="${entries[$i]}"
    # Never delete the release current points at.
    if [[ -L "$CURRENT_LINK" ]]; then
      local cur
      cur="$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)"
      if [[ "$cur" == "$(readlink -f "$RELEASES_DIR/$name" 2>/dev/null || true)" ]]; then
        continue
      fi
    fi
    log "Pruning old release $name"
    rm -rf "$RELEASES_DIR/$name"
  done
}

migrate_inplace_tree_aside() {
  # First migration from legacy in-place install (files directly under SMARTSTAY_HOME).
  if [[ -L "$CURRENT_LINK" ]]; then
    return 0
  fi
  if [[ ! -f "$SMARTSTAY_HOME/package.json" && ! -d "$SMARTSTAY_HOME/backend" ]]; then
    return 0
  fi

  local stamp
  stamp="$(date +%Y%m%d%H%M%S)"
  local aside="$SMARTSTAY_HOME/.legacy-inplace-$stamp"
  mkdir -p "$aside"
  log "Migrating legacy in-place tree aside → $aside"
  local item
  for item in "$SMARTSTAY_HOME"/*; do
    local base
    base="$(basename "$item")"
    case "$base" in
      releases|current|appdata|.legacy-inplace-*) continue ;;
    esac
    mv "$item" "$aside/" 2>/dev/null || true
  done
}

if [[ ! -f "$ARCHIVE" ]]; then
  fail "Archive not found: $ARCHIVE"
fi

mkdir -p "$APPDATA_DIR" "$RELEASES_DIR" 2>/dev/null || true
# Prevent systemd Restart= from bringing the app back while we replace files.
printf '%s\n' "$VERSION" >"$OTA_LOCK_FILE"
trap 'release_lock' EXIT

# Let the parent Node process finish its "applying" heartbeat, then stop.
sleep 2

stop_service() {
  if ! command -v systemctl >/dev/null 2>&1; then
    fail "systemctl not available"
  fi
  log "Stopping $SERVICE_NAME before applying files"
  if ! try_systemctl stop; then
    log "WARN: cannot systemctl stop $SERVICE_NAME — install passwordless sudo for OTA:"
    log "  sudo cp $SMARTSTAY_HOME/current/scripts/smartstay-systemctl.sudoers /etc/sudoers.d/smartstay-systemctl && sudo chmod 440 /etc/sudoers.d/smartstay-systemctl"
    free_app_port
    sleep 1
    return 0
  fi
  free_app_port
  sleep 1
}

start_service() {
  free_app_port
  # Allow ExecStartPre wait-ota-lock.sh / systemd to proceed.
  release_lock

  if ! command -v systemctl >/dev/null 2>&1; then
    fail "systemctl not available; cannot start $SERVICE_NAME"
  fi
  log "Starting $SERVICE_NAME"
  if ! try_systemctl start; then
    fail "systemctl start $SERVICE_NAME failed (no start.sh fallback)"
  fi
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

SRC="$WORKDIR"
if [[ "$(find "$WORKDIR" -mindepth 1 -maxdepth 1 | wc -l)" -eq 1 ]]; then
  ONLY="$(find "$WORKDIR" -mindepth 1 -maxdepth 1 -type d | head -n 1 || true)"
  if [[ -n "${ONLY:-}" ]]; then
    SRC="$ONLY"
  fi
fi

if [[ ! -f "$SRC/package.json" ]]; then
  fail "Invalid archive: package.json missing"
fi
if [[ ! -f "$SRC/backend/dist/index.js" ]]; then
  fail "Invalid archive: backend/dist/index.js missing (expected fully bundled release)"
fi

migrate_inplace_tree_aside

log "Installing release into $TARGET_DIR"
rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"
# Fully bundled release — copy tree as-is (no pnpm/npm on device).
cp -a "$SRC/." "$TARGET_DIR/"
chmod +x "$TARGET_DIR/scripts/"*.sh 2>/dev/null || true

if [[ ! -f "$TARGET_DIR/backend/dist/index.js" ]]; then
  fail "Release install incomplete: backend/dist/index.js missing at $TARGET_DIR"
fi

log "Flipping current → releases/$VERSION"
# Relative symlink so the home dir remains relocatable.
atomic_symlink "releases/$VERSION" "$CURRENT_LINK"

rm -f "$APPDATA_DIR/pending-update.json" 2>/dev/null || true
# Legacy path from older OTA builds
rm -f "$SMARTSTAY_HOME/appdata/pending-update.json" 2>/dev/null || true

prune_releases

start_service

if wait_for_version "$VERSION"; then
  write_result true
  log "Update to $VERSION applied (current=$(readlink "$CURRENT_LINK" 2>/dev/null || echo "?"))"
else
  fail "Service did not report version ${VERSION} on :${APP_PORT}/api/info within ${HEALTH_TIMEOUT_SEC}s"
fi
