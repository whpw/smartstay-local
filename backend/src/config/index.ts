import { db } from '@/db'
import { normalizeComplimentaryAddons } from '@/reservations/complimentary-addons'
import { logger } from '@/utils/logger'
import ky from 'ky'
import type { AppConfig } from './types'

// Exporting initialized config
export let appConfig!: AppConfig

const COMPLIMENTARY_REFRESH_TTL_MS = 60_000
let lastComplimentaryRefreshAt = 0

async function fetchRemoteConfig() {
  const CONFIG_API_URL = process.env.CONFIG_API_URL as string
  const CONFIG_API_KEY = process.env.CONFIG_API_KEY as string

  return ky
    .get<AppConfig>(CONFIG_API_URL, {
      headers: {
        Authorization: `Bearer ${CONFIG_API_KEY}`,
      },
    })
    .json()
}

/**
 * Re-read complimentary addons from the panel so a save there applies on the
 * next login / session start without waiting for a room-app reboot.
 */
export async function refreshComplimentaryAddons() {
  if (!appConfig || !process.env.CONFIG_API_URL) {
    return
  }

  const now = Date.now()
  if (now - lastComplimentaryRefreshAt < COMPLIMENTARY_REFRESH_TTL_MS) {
    return
  }

  try {
    const remote = await fetchRemoteConfig()
    const complimentaryAddons = normalizeComplimentaryAddons(
      remote.complimentaryAddons,
    )
    appConfig.complimentaryAddons = complimentaryAddons
    lastComplimentaryRefreshAt = now

    const cached = db().get<AppConfig | undefined>('appConfig')
    if (cached) {
      db().set('appConfig', { ...cached, complimentaryAddons })
    }
  } catch (err) {
    logger.error('Error refreshing complimentary addons:', err)
  }
}

// Exporting config initialization function
export async function initConfig() {
  logger.debug('Initializing config...')

  // Get devices config
  const loadedConfig = await fetchRemoteConfig()
    .then((remoteConfig) => {
      logger.info('Remote config initialized successfully')

      // Storing config
      db().set('appConfig', remoteConfig)

      // Return received config
      return remoteConfig
    })
    .catch((err) => {
      logger.error('Error getting remote config:', err)

      // Using cached version of the config
      const configFromDb = db().get<AppConfig | undefined>('appConfig')

      logger.info('Using cached config', configFromDb)

      if (!configFromDb) {
        throw new Error('Local config not found')
      }

      return configFromDb
    })

  // Setting default timezone
  if (!loadedConfig.tz) {
    loadedConfig.tz = 'Europe/Warsaw'
  }

  // Setting default lat and lng
  if (isNaN(loadedConfig.lat) || isNaN(loadedConfig.lng)) {
    loadedConfig.lat = 52.15
    loadedConfig.lng = 21
  }

  loadedConfig.complimentaryAddons = normalizeComplimentaryAddons(
    loadedConfig.complimentaryAddons,
  )
  lastComplimentaryRefreshAt = Date.now()

  // Assigning config to the exported variable
  appConfig = loadedConfig

  return appConfig
}
