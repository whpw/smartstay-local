import { basename, resolve } from 'node:path'
import { resolveInstallRoot } from './version'

/**
 * Durable state beside the install home:
 *   /home/smartstay/smartstay-local  (SMARTSTAY_HOME; current → releases/<ver>)
 *   /home/smartstay/appdata          (.env, cache, logs, ota-*.json/log)
 */
export function resolveAppdataDir(installRoot = resolveInstallRoot()): string {
  if (process.env.APPDATA_DIR) {
    return resolve(process.env.APPDATA_DIR)
  }
  if (process.env.SMARTSTAY_HOME) {
    return resolve(process.env.SMARTSTAY_HOME, '..', 'appdata')
  }
  // .../smartstay-local/current → /home/smartstay/appdata
  if (basename(installRoot) === 'current') {
    return resolve(installRoot, '../..', 'appdata')
  }
  // Legacy in-place tree: .../smartstay-local → /home/smartstay/appdata
  return resolve(installRoot, '..', 'appdata')
}

/** Base dir that owns `current` and `releases/` (or the legacy in-place root). */
export function resolveSmartstayHome(installRoot = resolveInstallRoot()): string {
  if (process.env.SMARTSTAY_HOME) {
    return resolve(process.env.SMARTSTAY_HOME)
  }
  if (basename(installRoot) === 'current') {
    return resolve(installRoot, '..')
  }
  return installRoot
}
