import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readPackageVersion(): string {
  try {
    const pkgPath = resolve(process.cwd(), 'package.json')
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
