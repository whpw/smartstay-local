# AGENTS.md

## Cursor Cloud specific instructions

### What this project is

`smartstay-local` is the on-site "room app" for SmartStay rental properties. It is a
**pnpm** monorepo (`pnpm-workspace.yaml`) with two packages:

- `backend/` (`@repo/backend`) — Hono API (Node, `tsx` / `esbuild`). Talks to physical devices
  (sauna, jacuzzi, heating, light switches) on the local network and serves the built frontend
  in production.
- `frontend/` (`@repo/frontend`) — React 19 + Vite 8 + MUI 9 guest UI.

### Package manager (required)

- **Always use `pnpm`.** Never use `npm`, `npx`, `yarn`, or `bun` for install/run/scripts.
- Install: `pnpm install` from the repo root.
- Run scripts via root `package.json` (`pnpm dev`, `pnpm build`, …) or filter packages
  (`pnpm -F @repo/frontend …`, `pnpm -F @repo/backend …`). Prefer those over re-deriving commands.
- Workspace membership is defined only in `pnpm-workspace.yaml` (not `package.json` `workspaces`).

### Node

- Use Node **26.7.0** (pinned in `.nvmrc`) via nvm: `nvm use` (or prepend
  `"$HOME/.nvm/versions/node/v26.7.0/bin"` to `PATH`). The base image's default `/exec-daemon/node`
  is v22 and takes precedence on `PATH` unless you do this. Node 22 mostly works but 26 matches CI.

### Running the app (dev)

`pnpm dev` runs both packages in parallel:

| Service | URL |
|---------|-----|
| Frontend (Vite, proxies `/api` → `:8081`) | `http://localhost:8080` |
| Backend (Hono) | `http://localhost:8081` |

#### With mocked devices (recommended for UI work)

`pnpm dev:mock` starts a local HTTP mock for ThermoBox, SaunaBox, and LightSwitch on `:9100`, then
runs `pnpm dev` with `MOCK_DEVICES=1` so BleBox controllers skip `.local` mDNS and talk to the mock.
It copies [`backend/dev-config.example.json`](backend/dev-config.example.json) to
`backend/appdata/dev-config.json` if that file is missing (devices use SNs `MOCKJAC` / `MOCKHEAT` /
`MOCKLSW` and sauna `ip` `127.0.0.1:9100/saunabox`). The script sets `weatherUrl` to the IMGW Pułtusk
meteo station (`https://danepubliczne.imgw.pl/api/data/meteo/id/252210050`) — heating stays
**active** only while average outdoor temp is below `externalTempLimit` (18°C) — and `sunsetUrl` to
`https://api.sunrise-sunset.org/json` with `lat`/`lng` `52.15` / `21` (date is appended by the
backend). Lights follow sunset + `turnOnShift` until `turnOffAt` (22:00); before that window the UI
shows **Włącz**.

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
pnpm dev:mock
# → mock :9100, frontend :8080, backend :8081
```

Mock only: `pnpm -F @repo/backend mock:devices`. Override port with `MOCK_DEVICES_PORT`.

#### Without mocks (config only)

The non-obvious catch: **the backend refuses to boot without a remote app config.** On startup it
`GET`s `CONFIG_API_URL` (with `Bearer CONFIG_API_KEY`) and, on failure, falls back to a cached config
in `${APPDATA_DIR}/cache` — which is empty on a fresh VM, so boot aborts with "Local config not
found". In production these point at the SmartStay panel API (secrets). For local dev there is no
panel, so provide a self-contained config via a `data:` URL (Node `fetch`/`ky` accept `data:` URLs,
so no mock config server is needed). A ready-made example lives at
`backend/dev-config.example.json`; copy it to `backend/appdata/dev-config.json` (gitignored) or use
`pnpm dev:mock` which does that for you.

Start the dev servers like this (from repo root):

```bash
export PATH="$HOME/.nvm/versions/node/v26.7.0/bin:$PATH"
export APPDATA_DIR="$PWD/backend/appdata"
mkdir -p "$APPDATA_DIR"
cp -n backend/dev-config.example.json backend/appdata/dev-config.json
export CONFIG_API_URL="data:application/json,$(node -e 'console.log(encodeURIComponent(require("fs").readFileSync("backend/appdata/dev-config.json","utf8")))')"
pnpm install
pnpm dev
```

`APPDATA_DIR` must be a real env var (it is read to locate the optional `${APPDATA_DIR}/.env` and the
flat-cache dir); other secrets like `CONFIG_API_KEY`, `CONFIG_API_URL`, `ADMIN_RES_NUMBER`,
`ADMIN_LAST_NAME` can instead go in `${APPDATA_DIR}/.env` (loaded via dotenv, does not override
existing env vars).

Expected/harmless dev log noise once running: `Error updating local IP`, `Missing CONFIG_API_URL ...
for heartbeat`, `Next reservation not found`. Without `MOCK_DEVICES=1` and a running mock server,
device controllers also log repeated `Failed to connect to API` retries — they do **not** block
boot. With `pnpm dev:mock`, those discovery failures should stop once the mock is up.

### Logging in (guest flow)

With `NODE_ENV=development` (the `dev` script sets it), login is mocked: any reservation number works
as long as the last name is **`test`** (see `backend/src/reservations/dev.ts`). On the login page
enter last name `test` + any reservation number (e.g. `12345`) to reach the dashboard. There is also
an admin path gated by `ADMIN_RES_NUMBER` / `ADMIN_LAST_NAME` env vars.

### Scripts (repo root)

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install workspace deps |
| `pnpm dev` | Frontend + backend in parallel |
| `pnpm typecheck` | `tsc` in both packages |
| `pnpm build` | Frontend Vite build + backend esbuild bundle |
| `pnpm start` | Run production backend (`dist`) |
| `pnpm lint` | oxlint (check) |
| `pnpm lint:fix` | oxlint `--fix` |
| `pnpm format` | oxfmt `--check` |
| `pnpm format:fix` | oxfmt (write) |

### Tests

There is no root `test` script. The backend has plain `node:assert` scripts under
`backend/src/utils/*.test.ts`; run one with:

```bash
pnpm --dir backend exec tsx src/utils/<name>.test.ts
```

(exit 0 = pass). They are self-contained and need no running server.

### Lint / format / hooks

- Lint/format tools live at the **repo root** (`oxlint`, `oxfmt`).
- Pre-commit (husky → lint-staged): `oxfmt` on all staged files, `oxlint --fix` on JS/TS,
  and `pnpm typecheck` once if any `.ts`/`.tsx` is staged.
