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

The non-obvious catch: **the backend refuses to boot without a remote app config.** On startup it
`GET`s `CONFIG_API_URL` (with `Bearer CONFIG_API_KEY`) and, on failure, falls back to a cached config
in `${APPDATA_DIR}/cache` — which is empty on a fresh VM, so boot aborts with "Local config not
found". In production these point at the SmartStay panel API (secrets). For local dev there is no
panel, so provide a self-contained config via a `data:` URL (Node `fetch`/`ky` accept `data:` URLs,
so no mock server is needed). A ready-made dev config lives at
`backend/appdata/dev-config.json` (this path is gitignored). If it is missing, recreate it with any
valid `AppConfig` (see `backend/src/config/types.ts`); at minimum set `objectName`, numeric
`lat`/`lng`, a `tz`, `checkinHour`/`checkoutHour`, a `hotresRoomId`, and a `devices` array.

Start the dev servers like this (from repo root):

```bash
export PATH="$HOME/.nvm/versions/node/v24.10.0/bin:$PATH"
export APPDATA_DIR="$PWD/backend/appdata"
mkdir -p "$APPDATA_DIR"
export CONFIG_API_URL="data:application/json,$(node -e 'console.log(encodeURIComponent(require("fs").readFileSync("backend/appdata/dev-config.json","utf8")))')"
pnpm dev
```

`APPDATA_DIR` must be a real env var (it is read to locate the optional `${APPDATA_DIR}/.env` and the
flat-cache dir); other secrets like `CONFIG_API_KEY`, `CONFIG_API_URL`, `ADMIN_RES_NUMBER`,
`ADMIN_LAST_NAME` can instead go in `${APPDATA_DIR}/.env` (loaded via dotenv, does not override
existing env vars).

Expected/harmless dev log noise once running: `Error updating local IP`, `Missing CONFIG_API_URL ...
for heartbeat`, `Next reservation not found`, and repeated `LightSwitchController ... Failed to
connect to API` retries — all because there is no real panel or device hardware. Device controllers
retry hardware discovery forever in the background and do **not** block boot.

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
