import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import ky from 'ky'
import { resolveAppdataDir } from '../paths'

export type RemoteLogLevel = 'info' | 'warn' | 'error'

export type RemoteLogEntry = {
  ts: number
  level: RemoteLogLevel
  namespace: string
  message: string
}

const APPDATA_DIR = resolveAppdataDir()
const LOGS_DIR = resolve(APPDATA_DIR, 'logs')
const PENDING_PATH = resolve(LOGS_DIR, 'pending.jsonl')
const CURSOR_PATH = resolve(LOGS_DIR, 'pending.cursor')
const MAX_MESSAGE_LENGTH = 2048
const MAX_BATCH = 100
const FLUSH_INTERVAL_MS = 5_000
const FLUSH_BATCH_THRESHOLD = 50
const MAX_PENDING_BYTES = 10 * 1024 * 1024
const RETENTION_MS = 48 * 60 * 60 * 1000
const MIN_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 5 * 60 * 1000

let ensuredDir = false
let unsentSinceFlush = 0
let flushTimer: ReturnType<typeof setInterval> | null = null
let flushing = false
let backoffMs = MIN_BACKOFF_MS
let nextAttemptAt = 0
let disposed = false

function ensureDir() {
  if (ensuredDir) {
    return
  }
  mkdirSync(LOGS_DIR, { recursive: true })
  ensuredDir = true
}

function readCursor(): number {
  try {
    if (!existsSync(CURSOR_PATH)) {
      return 0
    }
    const raw = readFileSync(CURSOR_PATH, 'utf8').trim()
    const value = Number(raw)
    return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0
  } catch {
    return 0
  }
}

function writeCursor(offset: number) {
  ensureDir()
  writeFileSync(CURSOR_PATH, `${offset}\n`, 'utf8')
}

function truncateMessage(message: string) {
  if (message.length <= MAX_MESSAGE_LENGTH) {
    return message
  }
  return `${message.slice(0, MAX_MESSAGE_LENGTH - 1)}…`
}

export function formatLogArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg
      }
      if (arg instanceof Error) {
        return arg.stack || arg.message
      }
      try {
        return JSON.stringify(arg)
      } catch {
        return String(arg)
      }
    })
    .join(' ')
}

export function appendRemoteLog(
  level: RemoteLogLevel,
  namespace: string,
  args: unknown[],
) {
  if (disposed) {
    return
  }

  try {
    ensureDir()
    const entry: RemoteLogEntry = {
      ts: Date.now(),
      level,
      namespace,
      message: truncateMessage(formatLogArgs(args)),
    }
    writeFileSync(PENDING_PATH, `${JSON.stringify(entry)}\n`, {
      encoding: 'utf8',
      flag: 'a',
    })
    unsentSinceFlush += 1
    maybeCompactPendingFile()
    if (unsentSinceFlush >= FLUSH_BATCH_THRESHOLD) {
      void flushRemoteLogs()
    }
  } catch (error) {
    console.error('[remote-logger] Failed to append log', error)
  }
}

function logsUrlFromConfigApiUrl(configApiUrl: string) {
  if (configApiUrl.endsWith('/config')) {
    return `${configApiUrl.slice(0, -'/config'.length)}/logs`
  }
  if (configApiUrl.endsWith('/config/')) {
    return `${configApiUrl.slice(0, -'/config/'.length)}/logs`
  }
  return `${configApiUrl.replace(/\/$/, '')}/logs`
}

function readUnsentEntries(limit: number): {
  entries: RemoteLogEntry[]
  nextOffset: number
} {
  ensureDir()
  if (!existsSync(PENDING_PATH)) {
    return { entries: [], nextOffset: 0 }
  }

  const fd = openSync(PENDING_PATH, 'r')
  try {
    const size = fstatSync(fd).size
    let offset = Math.min(readCursor(), size)
    const entries: RemoteLogEntry[] = []
    let buffer = ''
    const startOffset = offset

    while (entries.length < limit && offset < size) {
      const chunkSize = Math.min(64 * 1024, size - offset)
      const chunk = Buffer.alloc(chunkSize)
      const bytesRead = readSync(fd, chunk, 0, chunkSize, offset)
      if (bytesRead <= 0) {
        break
      }
      offset += bytesRead
      buffer += chunk.subarray(0, bytesRead).toString('utf8')

      let newlineIndex = buffer.indexOf('\n')
      while (newlineIndex !== -1 && entries.length < limit) {
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        if (line) {
          try {
            const parsed = JSON.parse(line) as RemoteLogEntry
            if (
              typeof parsed.ts === 'number' &&
              typeof parsed.level === 'string' &&
              typeof parsed.namespace === 'string' &&
              typeof parsed.message === 'string'
            ) {
              entries.push({
                ts: parsed.ts,
                level: parsed.level as RemoteLogLevel,
                namespace: parsed.namespace,
                message: truncateMessage(parsed.message),
              })
            }
          } catch {
            // Skip corrupt lines
          }
        }
        newlineIndex = buffer.indexOf('\n')
      }
    }

    const consumedFromStart =
      Buffer.byteLength(
        // Reconstruct consumed portion length: total read minus leftover partial line
        buffer.length === 0
          ? ''
          : buffer,
        'utf8',
      )
    const nextOffset = offset - consumedFromStart
    // If we never advanced past start and found nothing usable, still move past corrupt region when empty batch
    if (entries.length === 0 && offset > startOffset && buffer.length === 0) {
      return { entries, nextOffset: offset }
    }
    return { entries, nextOffset }
  } finally {
    closeSync(fd)
  }
}

function pendingFileSize() {
  if (!existsSync(PENDING_PATH)) {
    return 0
  }
  const fd = openSync(PENDING_PATH, 'r')
  try {
    return fstatSync(fd).size
  } finally {
    closeSync(fd)
  }
}

function maybeCompactPendingFile() {
  try {
    const size = pendingFileSize()
    const cursor = readCursor()
    if (cursor > 256 * 1024 || size > MAX_PENDING_BYTES || cursor > size) {
      compactPendingFile()
    }
  } catch (error) {
    console.error('[remote-logger] Compact check failed', error)
  }
}

function compactPendingFile() {
  if (!existsSync(PENDING_PATH)) {
    writeCursor(0)
    return
  }

  const cutoff = Date.now() - RETENTION_MS
  const content = readFileSync(PENDING_PATH, 'utf8')
  const cursor = Math.min(readCursor(), content.length)
  const unsent = content.slice(cursor)

  const kept: string[] = []
  for (const line of unsent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }
    try {
      const parsed = JSON.parse(trimmed) as RemoteLogEntry
      if (typeof parsed.ts === 'number' && parsed.ts < cutoff) {
        continue
      }
    } catch {
      continue
    }
    kept.push(`${trimmed}\n`)
  }

  // Drop oldest lines until under size cap
  let start = 0
  let bytes = kept.reduce(
    (sum, line) => sum + Buffer.byteLength(line, 'utf8'),
    0,
  )
  while (bytes > MAX_PENDING_BYTES && start < kept.length) {
    bytes -= Buffer.byteLength(kept[start]!, 'utf8')
    start += 1
  }

  const joined = kept.slice(start).join('')
  const tmpPath = `${PENDING_PATH}.tmp`
  writeFileSync(tmpPath, joined, 'utf8')
  renameSync(tmpPath, PENDING_PATH)
  writeCursor(0)
}

export async function flushRemoteLogs() {
  if (flushing || disposed) {
    return
  }

  const now = Date.now()
  if (now < nextAttemptAt) {
    return
  }

  const configApiUrl = process.env.CONFIG_API_URL
  const apiKey = process.env.CONFIG_API_KEY
  if (!configApiUrl || !apiKey) {
    return
  }

  flushing = true
  try {
    const { entries, nextOffset } = readUnsentEntries(MAX_BATCH)
    if (entries.length === 0) {
      unsentSinceFlush = 0
      maybeCompactPendingFile()
      return
    }

    const url = logsUrlFromConfigApiUrl(configApiUrl)
    await ky.post(url, {
      json: { entries },
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      timeout: 15_000,
      retry: 0,
    })

    writeCursor(nextOffset)
    unsentSinceFlush = Math.max(0, unsentSinceFlush - entries.length)
    backoffMs = MIN_BACKOFF_MS
    nextAttemptAt = 0
    maybeCompactPendingFile()
  } catch (error) {
    nextAttemptAt = Date.now() + backoffMs
    backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS)
    console.error('[remote-logger] Failed to flush logs', error)
  } finally {
    flushing = false
  }
}

export function startRemoteLogger() {
  disposed = false
  ensureDir()
  if (flushTimer) {
    return
  }
  flushTimer = setInterval(() => {
    void flushRemoteLogs()
  }, FLUSH_INTERVAL_MS)
  flushTimer.unref?.()
  void flushRemoteLogs()
}

export async function stopRemoteLogger() {
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  // Final best-effort flush while still accepting no new appends after
  try {
    await flushRemoteLogs()
  } catch {
    // ignore
  }
  disposed = true
}

export function resetRemoteLoggerForTests() {
  disposed = false
  unsentSinceFlush = 0
  flushing = false
  backoffMs = MIN_BACKOFF_MS
  nextAttemptAt = 0
  ensuredDir = false
  if (flushTimer) {
    clearInterval(flushTimer)
    flushTimer = null
  }
  try {
    if (existsSync(PENDING_PATH)) {
      unlinkSync(PENDING_PATH)
    }
    if (existsSync(CURSOR_PATH)) {
      unlinkSync(CURSOR_PATH)
    }
  } catch {
    // ignore
  }
}
