# AGENTS.md

## Cursor Cloud specific instructions

### What this project is

`client-smartstay-app-hono` is the on-site "room app" for SmartStay rental properties. It is a
pnpm monorepo with two workspaces:

- `backend/` — Hono API (Node, `tsx`/`esbuild`). Talks to physical devices (sauna, jacuzzi,
  heating, light switches) on the local network and serves the built frontend in production.
- `frontend/` — React 19 + Vite 7 + MUI guest UI.

Standard scripts live in the root and workspace `package.json` files (`pnpm dev`, `pnpm build`,
`pnpm start`); prefer those over re-deriving commands.

### Node / package manager

- Use Node **24.10.0** (pinned in `.nvmrc`) via nvm: `nvm use` (or prepend
  `"$HOME/.nvm/versions/node/v24.10.0/bin"` to `PATH`). The base image's default `/exec-daemon/node`
  is v22 and takes precedence on `PATH` unless you do this. Node 22 mostly works but 24 matches CI.
- Dependencies are installed by the startup update script (`pnpm install`).

### Running the app (dev)

`pnpm dev` runs both workspaces in parallel: **frontend** on `http://localhost:8080` (Vite, proxies
`/api` → `:8081`) and **backend** on `http://localhost:8081`.

#### With mocked devices (recommended for UI work)

`pnpm dev:mock` starts a local HTTP mock for ThermoBox, SaunaBox, and LightSwitch on `:9100`, then
runs `pnpm dev` with `MOCK_DEVICES=1` so BleBox controllers skip `.local` mDNS and talk to the mock.
It copies [`backend/dev-config.example.json`](backend/dev-config.example.json) to
`backend/appdata/dev-config.json` if that file is missing (devices use SNs `MOCKJAC` / `MOCKHEAT` /
`MOCKLSW` and sauna `ip` `127.0.0.1:9100/saunabox`). The script also points `weatherUrl` at the
mock (`http://127.0.0.1:9100/weather`, outdoor 5°C) so heating stays **active** (it turns off when
average outdoor temp is at or above `externalTempLimit`).

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
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
export APPDATA_DIR="$PWD/backend/appdata"
mkdir -p "$APPDATA_DIR"
cp -n backend/dev-config.example.json backend/appdata/dev-config.json
export CONFIG_API_URL="data:application/json,$(node -e 'console.log(encodeURIComponent(require("fs").readFileSync("backend/appdata/dev-config.json","utf8")))')"
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
as long as the last name is **`test`** (see `backend/src/reservations/dev.ts`). So on the login page
enter last name `test` + any reservation number (e.g. `12345`) to reach the dashboard. There is also
an admin path gated by `ADMIN_RES_NUMBER` / `ADMIN_LAST_NAME` env vars.

### Lint / test / build

- **Build:** `pnpm build` (frontend Vite build + backend esbuild bundle). Works out of the box.
- **Tests:** there is no `test` script. The backend has plain `node:assert` scripts
  (`backend/src/utils/*.test.ts`); run one with `pnpm --dir backend exec tsx src/utils/<name>.test.ts`
  (exit 0 = pass). They are self-contained and need no running server.
- **Lint:** there is no `lint` script and `eslint` is not a root dependency. The frontend
  `eslint.config.js` currently fails with the installed `eslint-plugin-react-hooks` (flat-config
  "plugins must be an object") — a pre-existing config issue, not an environment problem.
