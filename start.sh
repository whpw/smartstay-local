#!/usr/bin/env bash
# Node must be the systemd main process (via exec). With KillMode=process,
# only the main PID is stopped — if this script stayed as main, Node would
# keep holding :8080 across restarts.
set -euo pipefail

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"

exec npm start
