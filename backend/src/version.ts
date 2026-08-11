import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function resolveInstallRoot(): string {
  if (process.env.INSTALL_ROOT) {
    return resolve(process.env.INSTALL_ROOT)
  }

  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    // When running from source (backend/src/version.ts), root is ../../..
    resolve(here, '../../..'),
    resolve(here, '../..'), // backend/dist → root
    resolve(here, '..'), // backend/src → backend (fallback)
    resolve(process.cwd(), '..'),
    process.cwd(),
  ]

  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(
        readFileSync(join(candidate, 'package.json'), 'utf8'),
      ) as { name?: string }
      if (
        pkg.name === 'smartstay-local' ||
        pkg.name === 'client-smartstay-app-hono'
      ) {
        return candidate
      }
    } catch {
      // try next
    }
  }

  return resolve(process.cwd(), '..')
}

/** Re-read package.json version from disk (not cached). */
export function readDiskVersion(): string {
  try {
    const pkgPath = join(resolveInstallRoot(), 'package.json')
    if (!existsSync(pkgPath)) {
      throw new Error('package.json missing')
    }
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      version?: string
    }
    if (pkg.version) {
      return pkg.version
    }
  } catch {
    // fall through
  }
  return '0.0.0'
}

/** Semver reported to the panel on heartbeats (captured at process start). */
export const APP_VERSION = process.env.APP_VERSION?.trim() || readDiskVersion()
