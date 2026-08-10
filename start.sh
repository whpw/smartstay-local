#!/usr/bin/env bash
# With KillMode=process, systemd only stops the main PID. Do not start via
# npm/pnpm — those leave sh/node children in the cgroup (leftover-process
# warnings and :8080 held across restarts). Exec the backend Node process
# so it is the main PID. Detached OTA apply-update.sh can still survive.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Durable state beside the install tree (same layout as backend ../../appdata).
APPDATA_DIR="${APPDATA_DIR:-$(cd "$ROOT/.." && pwd)/appdata}"
OTA_LOCK_FILE="${OTA_LOCK_FILE:-$APPDATA_DIR/ota.lock}"
# Older OTA builds wrote the lock under the install tree.
LEGACY_OTA_LOCK_FILE="$ROOT/appdata/ota.lock"

wait_for_ota_lock() {
  local lock=""
  if [[ -f "$OTA_LOCK_FILE" ]]; then
    lock="$OTA_LOCK_FILE"
  elif [[ -f "$LEGACY_OTA_LOCK_FILE" ]]; then
    lock="$LEGACY_OTA_LOCK_FILE"
  else
    return 0
  fi

  echo "OTA in progress (lock=$lock); waiting up to 600s before start…" >&2
  local i=0
  while [[ -f "$lock" ]]; do
    if (( i >= 600 )); then
      echo "OTA lock still present after 600s; starting anyway" >&2
      break
    fi
    sleep 1
    i=$((i + 1))
  done
}

wait_for_ota_lock

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"

export NODE_ENV="${NODE_ENV:-production}"
# Match backend package.json "start" script.
export DEBUG="${DEBUG:-*,-*:debug}"

# App code resolves ../../appdata relative to cwd=backend (same as pnpm -F backend).
cd "$ROOT/backend"
exec node dist/index.js
