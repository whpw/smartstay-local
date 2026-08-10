#!/usr/bin/env bash
# Pack a deployable smartstay-local release archive (fully bundled backend + frontend dist).
# Usage: ./scripts/pack-release.sh [version] [output.tar.gz]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="${1:-$(node -p "require('./package.json').version")}"
OUT="${2:-$ROOT/dist-release/smartstay-local-${VERSION}.tar.gz}"

echo "Building smartstay-local ${VERSION}…"
pnpm install --frozen-lockfile
pnpm build

if [[ ! -f "$ROOT/backend/dist/index.js" ]]; then
  echo "backend/dist/index.js missing after build" >&2
  exit 1
fi
if [[ ! -d "$ROOT/frontend/dist" ]]; then
  echo "frontend/dist missing after build" >&2
  exit 1
fi

STAGE="$(mktemp -d /tmp/smartstay-pack-XXXXXX)"
trap 'rm -rf "$STAGE"' EXIT

DEST="$STAGE/smartstay-local"
mkdir -p "$DEST/backend" "$DEST/frontend" "$DEST/scripts"

# Version metadata only — devices do not run pnpm/npm install.
cp package.json service.conf "$DEST/"
cp -R scripts "$DEST/"
chmod +x "$DEST/scripts/"*.sh 2>/dev/null || true
cp backend/package.json "$DEST/backend/"
cp -R backend/dist "$DEST/backend/dist"
cp frontend/package.json "$DEST/frontend/"
cp -R frontend/dist "$DEST/frontend/dist"

mkdir -p "$(dirname "$OUT")"
tar -czf "$OUT" -C "$STAGE" smartstay-local

SHA="$(sha256sum "$OUT" | awk '{print $1}')"
echo "Packed $OUT"
echo "sha256=$SHA"
echo "version=$VERSION"
