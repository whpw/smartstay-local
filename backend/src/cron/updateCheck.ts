import { APP_VERSION, readDiskVersion, resolveInstallRoot } from '@/version'
import { resolveAppdataDir, resolveSmartstayHome } from '@/paths'
import { logger } from '@/utils/logger'
import { ip } from 'address'
import { CronJob } from 'cron'
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
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

type OtaResultFile = {
  ok: boolean
  version?: string
  error?: string
  finishedAt?: number
}

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

function resolveInstalledApplyScript(installRoot: string, smartstayHome: string) {
  const fromEnv = process.env.APPLY_UPDATE_SCRIPT
  if (fromEnv) {
    return fromEnv
  }
  const candidates = [
    join(installRoot, 'scripts/apply-update.sh'),
    join(smartstayHome, 'current/scripts/apply-update.sh'),
    join(smartstayHome, 'scripts/apply-update.sh'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return candidates[0]
}

/**
 * Prefer the apply-update.sh bundled inside the downloaded release so script
 * fixes take effect on the same upgrade (avoids chicken-and-egg where the old
 * installed script cannot stop/restart the service).
 */
function extractApplyScriptFromArchive(
  archivePath: string,
  destPath: string,
): boolean {
  const listed = spawnSync('tar', ['-tzf', archivePath], {
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  if (listed.status !== 0) {
    logger.warn(
      `Could not list update archive for apply script: ${listed.stderr || listed.error}`,
    )
    return false
  }

  const entry = listed.stdout
    .split('\n')
    .map((line) => line.trim())
    .find(
      (line) =>
        line === 'scripts/apply-update.sh' ||
        line.endsWith('/scripts/apply-update.sh'),
    )

  if (!entry) {
    logger.warn('Update archive has no scripts/apply-update.sh')
    return false
  }

  mkdirSync(dirname(destPath), { recursive: true })
  const extracted = spawnSync('tar', ['-xOzf', archivePath, entry], {
    maxBuffer: 4 * 1024 * 1024,
  })
  if (extracted.status !== 0 || !extracted.stdout?.length) {
    logger.warn(
      `Could not extract apply-update.sh from archive: ${extracted.stderr?.toString() || extracted.error}`,
    )
    return false
  }

  writeFileSync(destPath, extracted.stdout)
  chmodSync(destPath, 0o755)
  return true
}

function spawnApplyUpdate(
  archivePath: string,
  version: string,
  smartstayHome: string,
  installRoot: string,
) {
  const appdataDir = resolveAppdataDir(installRoot)
  const logFile = join(appdataDir, 'ota-apply.log')
  const serviceName = process.env.SYSTEMD_SERVICE || 'smartstay'

  let script = resolveInstalledApplyScript(installRoot, smartstayHome)
  const bootstrapped = join(appdataDir, `apply-update-${version}.sh`)
  if (extractApplyScriptFromArchive(archivePath, bootstrapped)) {
    script = bootstrapped
    logger.info(`Using apply-update.sh from release archive (${script})`)
  } else if (!existsSync(script)) {
    throw new Error(`apply-update.sh not found at ${script}`)
  } else {
    logger.warn(`Falling back to installed apply-update.sh at ${script}`)
  }

  const child = spawn(
    'bash',
    [script, archivePath, smartstayHome, serviceName, version],
    {
      detached: true,
      stdio: ['ignore', 'ignore', 'ignore'],
      env: {
        ...process.env,
        HOME: process.env.HOME,
        OTA_LOG_FILE: logFile,
        APPDATA_DIR: appdataDir,
        SMARTSTAY_HOME: smartstayHome,
      },
    },
  )

  child.on('error', (error) => {
    logger.error('Failed to spawn apply-update.sh:', error)
  })

  child.unref()
  logger.info(
    `Spawned apply-update.sh (pid ${child.pid}) for version ${version}; home=${smartstayHome}; log=${logFile}`,
  )
}

async function reportOtaResultIfAny(installRoot: string) {
  const appdataDir = resolveAppdataDir(installRoot)
  const candidates = [
    join(appdataDir, 'ota-result.json'),
    join(installRoot, 'appdata', 'ota-result.json'),
  ]

  for (const resultPath of candidates) {
    if (!existsSync(resultPath)) {
      continue
    }

    try {
      const result = JSON.parse(
        readFileSync(resultPath, 'utf8'),
      ) as OtaResultFile
      await postHeartbeat({
        version: APP_VERSION,
        updateStatus: result.ok ? 'success' : 'failed',
        updateError: result.ok
          ? null
          : (result.error || 'OTA apply failed').slice(0, 1024),
      })
      logger.info(
        `Reported OTA result to panel (ok=${result.ok}, file=${resultPath})`,
      )
    } catch (error) {
      logger.warn('Failed to report ota-result.json:', error)
    }

    await rm(resultPath, { force: true }).catch(() => undefined)
  }
}

/**
 * If files on disk were updated but this process never restarted (classic OTA
 * failure mode), exit so systemd brings us back on the new version.
 */
function exitIfDiskVersionAhead() {
  if (process.env.NODE_ENV !== 'production') {
    return
  }
  if (process.env.APP_VERSION?.trim()) {
    // Explicit override — do not self-heal.
    return
  }

  const diskVersion = readDiskVersion()
  if (!diskVersion || diskVersion === '0.0.0' || diskVersion === APP_VERSION) {
    return
  }

  logger.warn(
    `Disk package.json version=${diskVersion} differs from running APP_VERSION=${APP_VERSION}; exiting so systemd can restart onto the new build`,
  )
  // Non-zero so Restart=on-failure (and Restart=always) will respawn us.
  process.exit(1)
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
  const smartstayHome = resolveSmartstayHome(installRoot)
  const appdataDir = resolveAppdataDir(installRoot)
  const tmpDir = await mkdtemp(join(tmpdir(), 'smartstay-ota-'))
  const archivePath = join(
    tmpDir,
    `smartstay-local-${response.desiredVersion}.tar.gz`,
  )

  try {
    logger.info(
      `Downloading update ${response.desiredVersion} (installRoot=${installRoot}, smartstayHome=${smartstayHome})…`,
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
          smartstayHome,
          startedAt: Date.now(),
        },
        null,
        2,
      ),
    )

    spawnApplyUpdate(
      archivePath,
      response.desiredVersion,
      smartstayHome,
      installRoot,
    )
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
    exitIfDiskVersionAhead()

    const installRoot = resolveInstallRoot()
    await reportOtaResultIfAny(installRoot)

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
