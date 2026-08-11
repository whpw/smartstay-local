#!/usr/bin/env bash
# Start mock device APIs + frontend/backend for local development.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="${HOME}/.nvm/versions/node/v24.10.0/bin:${PATH}"

APPDATA_DIR="${APPDATA_DIR:-$ROOT/backend/appdata}"
mkdir -p "$APPDATA_DIR"

EXAMPLE_CONFIG="$ROOT/backend/dev-config.example.json"
DEV_CONFIG="$APPDATA_DIR/dev-config.json"

export APPDATA_DIR
export MOCK_DEVICES=1
export MOCK_DEVICES_PORT="${MOCK_DEVICES_PORT:-9100}"
export DEV_CONFIG

if [[ ! -f "$DEV_CONFIG" ]]; then
  echo "[dev:mock] Copying $EXAMPLE_CONFIG → $DEV_CONFIG"
  cp "$EXAMPLE_CONFIG" "$DEV_CONFIG"
fi

# Ensure IMGW weather + sunrise-sunset.org URLs. Restore lights turnOffAt if it was
# closed for the earlier mock-only default (00:00).
node <<'NODE'
const fs = require('fs')
const path = process.env.DEV_CONFIG
const weatherUrl =
  'https://danepubliczne.imgw.pl/api/data/meteo/id/252210050'
const sunsetUrl = 'https://api.sunrise-sunset.org/json'
const cfg = JSON.parse(fs.readFileSync(path, 'utf8'))
let changed = false
if (cfg.weatherUrl !== weatherUrl) {
  cfg.weatherUrl = weatherUrl
  changed = true
  console.log(`[dev:mock] Set weatherUrl → ${weatherUrl}`)
}
if (cfg.sunsetUrl !== sunsetUrl) {
  cfg.sunsetUrl = sunsetUrl
  changed = true
  console.log(`[dev:mock] Set sunsetUrl → ${sunsetUrl}`)
}
for (const device of cfg.devices || []) {
  if (device.type === 'light-switch' && device.sunsetMode?.turnOffAt === '00:00') {
    device.sunsetMode = { ...device.sunsetMode, turnOffAt: '22:00' }
    changed = true
    console.log(`[dev:mock] Set ${device.id} sunsetMode.turnOffAt → 22:00`)
  }
}
if (changed) {
  fs.writeFileSync(path, `${JSON.stringify(cfg, null, 2)}\n`)
}
NODE

export CONFIG_API_URL="data:application/json,$(node -e "console.log(encodeURIComponent(require('fs').readFileSync(process.argv[1],'utf8')))" "$DEV_CONFIG")"

MOCK_PID=""
cleanup() {
  if [[ -n "$MOCK_PID" ]] && kill -0 "$MOCK_PID" 2>/dev/null; then
    kill "$MOCK_PID" 2>/dev/null || true
    wait "$MOCK_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "[dev:mock] Starting mock device server on :${MOCK_DEVICES_PORT}"
pnpm -F @repo/backend mock:devices &
MOCK_PID=$!

# Wait until mock is accepting connections
for _ in $(seq 1 50); do
  if curl -sf "http://127.0.0.1:${MOCK_DEVICES_PORT}/health" >/dev/null 2>&1; then
    break
  fi
  if ! kill -0 "$MOCK_PID" 2>/dev/null; then
    echo "[dev:mock] Mock device server exited unexpectedly" >&2
    exit 1
  fi
  sleep 0.1
done

if ! curl -sf "http://127.0.0.1:${MOCK_DEVICES_PORT}/health" >/dev/null 2>&1; then
  echo "[dev:mock] Timed out waiting for mock device server" >&2
  exit 1
fi

echo "[dev:mock] Mock ready. Starting pnpm dev (frontend :8080, backend :8081)"
pnpm dev
