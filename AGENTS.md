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
export PATH="$HOME/.nvm/versions/node/v26.7.0/bin:$PATH"
export APPDATA_DIR="$PWD/backend/appdata"
mkdir -p "$APPDATA_DIR"
export CONFIG_API_URL="data:application/json,$(node -e 'console.log(encodeURIComponent(require("fs").readFileSync("backend/appdata/dev-config.json","utf8")))')"
pnpm install
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
