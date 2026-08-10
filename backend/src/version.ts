import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function resolveInstallRoot(): string {
  if (process.env.INSTALL_ROOT) {
    return resolve(process.env.INSTALL_ROOT)
  }

  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(here, '../..'), // backend/dist → root
    resolve(here, '../..'), // backend/src → still wrong for src; handled below
    resolve(here, '..'), // backend/src → backend (fallback)
    resolve(process.cwd(), '..'),
    process.cwd(),
  ]

  // When running from source (backend/src/version.ts), root is ../../..
  candidates.unshift(resolve(here, '../../..'))

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

function readPackageVersion(): string {
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

/** Semver reported to the panel on heartbeats. */
export const APP_VERSION =
  process.env.APP_VERSION?.trim() || readPackageVersion()
