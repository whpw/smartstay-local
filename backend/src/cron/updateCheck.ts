import { APP_VERSION } from '@/version'
import { logger } from '@/utils/logger'
import { ip } from 'address'
import { CronJob } from 'cron'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ky from 'ky'

type HeartbeatResponse = {
  latestVersion: string | null
  desiredVersion: string | null
  downloadUrl: string | null
  sha256: string | null
}

type UpdateStatus =
  | 'idle'
  | 'pending'
  | 'downloading'
  | 'applying'
  | 'failed'
  | 'success'

let updating = false

/**
 * Install root is the monorepo root (package.json with workspaces), not
 * `backend/`. pnpm start runs with cwd=backend, so process.cwd() alone is wrong.
 */
function resolveInstallRoot(): string {
  if (process.env.INSTALL_ROOT) {
    return resolve(process.env.INSTALL_ROOT)
  }

  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    // Bundled prod entry: backend/dist/index.js → ../..
    resolve(here, '../..'),
    // Dev source: backend/src/cron/updateCheck.ts → ../../..
    resolve(here, '../../..'),
    resolve(process.cwd(), '..'),
    process.cwd(),
  ]

  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(
        readFileSync(join(candidate, 'package.json'), 'utf8'),
      ) as { name?: string; workspaces?: unknown }
      if (
        pkg.name === 'client-smartstay-app-hono' ||
        Array.isArray(pkg.workspaces)
      ) {
        return candidate
      }
    } catch {
      // try next
    }
  }

  return resolve(process.cwd(), '..')
}

function resolveAppdataDir(installRoot: string) {
  if (process.env.APPDATA_DIR) {
    return resolve(process.env.APPDATA_DIR)
  }
  // Production layout keeps durable state beside the install tree, not inside it:
  //   /home/smartstay/smartstay-local  (code)
  //   /home/smartstay/appdata          (.env, cache, logs, ota-apply.log)
  // Matches backend relative paths (../../appdata from cwd=backend).
  return resolve(installRoot, '..', 'appdata')
}

function heartbeatUrlFromConfigApiUrl(configApiUrl: string) {
  if (configApiUrl.endsWith('/config')) {
    return `${configApiUrl.slice(0, -'/config'.length)}/config/heartbeat`
  }
  if (configApiUrl.endsWith('/config/')) {
    return `${configApiUrl.slice(0, -'/config/'.length)}/config/heartbeat`
  }
  return `${configApiUrl.replace(/\/$/, '')}/config/heartbeat`
}

async function postHeartbeat(body: {
  version: string
  ip?: string
  updateStatus?: UpdateStatus
  updateError?: string | null
}): Promise<HeartbeatResponse | null> {
  const configApiUrl = process.env.CONFIG_API_URL
  const apiKey = process.env.CONFIG_API_KEY
  if (!configApiUrl || !apiKey) {
    logger.error('Missing CONFIG_API_URL or CONFIG_API_KEY for heartbeat')
    return null
  }

  const url = heartbeatUrlFromConfigApiUrl(configApiUrl)
  return ky
    .post(url, {
      json: body,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 15_000,
      retry: 0,
    })
    .json<HeartbeatResponse>()
}

async function downloadArtifact(
  downloadUrl: string,
  destPath: string,
  expectedSha256: string,
) {
  const apiKey = process.env.CONFIG_API_KEY
  if (!apiKey) {
    throw new Error('Missing CONFIG_API_KEY')
  }

  const response = await ky.get(downloadUrl, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    timeout: 120_000,
    retry: 0,
  })

  const buffer = Buffer.from(await response.arrayBuffer())
  const digest = createHash('sha256').update(buffer).digest('hex')
  if (digest.toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error(
      `Checksum mismatch: expected ${expectedSha256}, got ${digest}`,
    )
  }

  await writeFile(destPath, buffer)
}

function resolveApplyScriptPath(installRoot: string) {
  const fromEnv = process.env.APPLY_UPDATE_SCRIPT
  if (fromEnv) {
    return fromEnv
  }
  return join(installRoot, 'scripts/apply-update.sh')
}

function spawnApplyUpdate(
  archivePath: string,
  version: string,
  installRoot: string,
) {
  const script = resolveApplyScriptPath(installRoot)
  if (!existsSync(script)) {
    throw new Error(`apply-update.sh not found at ${script}`)
  }

  const serviceName = process.env.SYSTEMD_SERVICE || 'smartstay'
  const logFile = join(resolveAppdataDir(installRoot), 'ota-apply.log')

  const child = spawn(
    'bash',
    [script, archivePath, installRoot, serviceName, version],
    {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      env: {
        ...process.env,
        HOME: process.env.HOME,
        OTA_LOG_FILE: logFile,
      },
    },
  )

  child.on('error', (error) => {
    logger.error('Failed to spawn apply-update.sh:', error)
  })

  child.unref()
  logger.info(
    `Spawned apply-update.sh (pid ${child.pid}) for version ${version}; log=${logFile}`,
  )
}

async function applyPendingUpdate(response: HeartbeatResponse) {
  if (
    !response.desiredVersion ||
    !response.downloadUrl ||
    !response.sha256
  ) {
    return
  }

  if (response.desiredVersion === APP_VERSION) {
    return
  }

  if (updating) {
    logger.info('Update already in progress, skipping')
    return
  }

  updating = true
  const installRoot = resolveInstallRoot()
  const appdataDir = resolveAppdataDir(installRoot)
  const tmpDir = await mkdtemp(join(tmpdir(), 'smartstay-ota-'))
  const archivePath = join(
    tmpDir,
    `smartstay-local-${response.desiredVersion}.tar.gz`,
  )

  try {
    logger.info(
      `Downloading update ${response.desiredVersion} (installRoot=${installRoot})…`,
    )
    await postHeartbeat({
      version: APP_VERSION,
      updateStatus: 'downloading',
      updateError: null,
    })

    await downloadArtifact(
      response.downloadUrl,
      archivePath,
      response.sha256,
    )

    await postHeartbeat({
      version: APP_VERSION,
      updateStatus: 'applying',
      updateError: null,
    })

    await mkdir(appdataDir, { recursive: true })
    await writeFile(
      join(appdataDir, 'pending-update.json'),
      JSON.stringify(
        {
          version: response.desiredVersion,
          archivePath,
          installRoot,
          startedAt: Date.now(),
        },
        null,
        2,
      ),
    )

    spawnApplyUpdate(archivePath, response.desiredVersion, installRoot)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('Failed to apply update:', error)
    await postHeartbeat({
      version: APP_VERSION,
      updateStatus: 'failed',
      updateError: message.slice(0, 1024),
    }).catch(() => undefined)
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined)
    updating = false
  }
}

export async function updateCheck() {
  logger.debug('Running update heartbeat…')
  try {
    const networkAddr = ip()
    const response = await postHeartbeat({
      version: APP_VERSION,
      ...(networkAddr ? { ip: networkAddr } : {}),
    })

    if (!response) {
      return
    }

    logger.info(
      `Heartbeat ok — version=${APP_VERSION} latest=${response.latestVersion} desired=${response.desiredVersion}`,
    )

    if (
      response.desiredVersion &&
      response.desiredVersion !== APP_VERSION &&
      response.downloadUrl &&
      response.sha256
    ) {
      await applyPendingUpdate(response)
    }
  } catch (error) {
    logger.error('Update heartbeat failed:', error)
  }
}

export function initUpdateCheck() {
  const cronJob = CronJob.from({
    // Every minute
    cronTime: '0 * * * * *',
    onTick: () => {
      void updateCheck()
    },
    start: true,
    runOnInit: true,
  })

  logger.info(
    'Update check cron scheduled to run at: ' + cronJob.nextDate().toISO(),
  )

  return () => cronJob.stop()
}
