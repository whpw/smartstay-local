#!/usr/bin/env bash
# With KillMode=process, systemd only stops the main PID. Do not start via
# npm/pnpm — those leave sh/node children in the cgroup (leftover-process
# warnings and :8080 held across restarts). Exec the backend Node process
# so it is the main PID. Detached OTA apply-update.sh can still survive.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"

export NODE_ENV="${NODE_ENV:-production}"
# Match backend package.json "start" script.
export DEBUG="${DEBUG:-*,-*:debug}"

# App code resolves ../../appdata relative to cwd=backend (same as pnpm -F backend).
cd "$ROOT/backend"
exec node dist/index.js
