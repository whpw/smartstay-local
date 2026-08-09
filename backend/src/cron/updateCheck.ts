import { APP_VERSION } from '@/version'
import { logger } from '@/utils/logger'
import { ip } from 'address'
import { CronJob } from 'cron'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
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

function resolveApplyScriptPath() {
  const fromEnv = process.env.APPLY_UPDATE_SCRIPT
  if (fromEnv) {
    return fromEnv
  }
  // Prefer install-root scripts/; fall back to repo-relative path in dev.
  const candidates = [
    resolve(process.cwd(), 'scripts/apply-update.sh'),
    resolve(
      dirname(fileURLToPath(import.meta.url)),
      '../../../scripts/apply-update.sh',
    ),
  ]
  return candidates[0]
}

function spawnApplyUpdate(archivePath: string, version: string) {
  const script = resolveApplyScriptPath()
  const installRoot = process.env.INSTALL_ROOT || process.cwd()
  const serviceName = process.env.SYSTEMD_SERVICE || 'smartstay'

  const child = spawn(
    'bash',
    [script, archivePath, installRoot, serviceName, version],
    {
      detached: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        HOME: process.env.HOME,
      },
    },
  )
  child.unref()
  logger.info(
    `Spawned apply-update.sh (pid ${child.pid}) for version ${version}`,
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
  const tmpDir = await mkdtemp(join(tmpdir(), 'smartstay-ota-'))
  const archivePath = join(tmpDir, `smartstay-local-${response.desiredVersion}.tar.gz`)

  try {
    logger.info(`Downloading update ${response.desiredVersion}…`)
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

    // Persist status file for the shell script / debugging
    await mkdir(join(process.cwd(), 'appdata'), { recursive: true }).catch(
      () => undefined,
    )
    await writeFile(
      join(process.cwd(), 'appdata', 'pending-update.json'),
      JSON.stringify(
        {
          version: response.desiredVersion,
          archivePath,
          startedAt: Date.now(),
        },
        null,
        2,
      ),
    ).catch(() => undefined)

    spawnApplyUpdate(archivePath, response.desiredVersion)
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
    // Every 5 minutes
    cronTime: '0 */5 * * * *',
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
