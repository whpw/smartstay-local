#!/usr/bin/env bash
# Wait while OTA holds the lock so systemd Restart= cannot race apply-update.
set -euo pipefail

APPDATA_DIR="${APPDATA_DIR:-/home/smartstay/appdata}"
OTA_LOCK_FILE="${OTA_LOCK_FILE:-$APPDATA_DIR/ota.lock}"
MAX_WAIT_SEC="${OTA_LOCK_WAIT_SEC:-600}"

if [[ ! -f "$OTA_LOCK_FILE" ]]; then
  exit 0
fi

echo "OTA in progress (lock=$OTA_LOCK_FILE); waiting up to ${MAX_WAIT_SEC}s before start…" >&2
i=0
while [[ -f "$OTA_LOCK_FILE" ]]; do
  if (( i >= MAX_WAIT_SEC )); then
    echo "OTA lock still present after ${MAX_WAIT_SEC}s; starting anyway" >&2
    break
  fi
  sleep 1
  i=$((i + 1))
done
