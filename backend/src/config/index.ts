import ky from 'ky'

import { db } from '@/db'
import { logger } from '@/utils/logger'

export type DeviceConfig = {
  id: string
  type: 'sauna' | 'jacuzzi' | 'heating' | 'light-switch'
  name: string
  disabled: boolean
}

export type Config = {
  icalUrl: string
  checkinHour: number
  checkoutHour: number
  roomId: string
  loginUrl: string
  hotresAuthCode: string
  hotresApiKey: string
  hotresAddonsUrl: string
  devices: Array<DeviceConfig>
}

export type AppConfig = {
  objectName: string
  apiKey: string
  weatherUrl: string
  sunsetUrl: string
  wifi: {
    name: string
    ssid: string
    pwd: string
    ip: string
  }
  config: Config
}

// Exporting initialized config
export let config!: Config
export let appConfig!: AppConfig

// Exporting config initialization function
export async function initConfig() {
  logger.debug('Initializing config...')

  const CONFIG_API_URL = process.env.CONFIG_API_URL as string
  const CONFIG_API_KEY = process.env.CONFIG_API_KEY as string

  // Get devices config
  const loadedConfig = await ky
    .get<AppConfig>(CONFIG_API_URL, {
      headers: {
        Authorization: `Bearer ${CONFIG_API_KEY}`,
      },
    })
    .json()
    .then((appConfig) => {
      logger.info('Remote config initialized successfully')

      // Storing config
      db().set('config', appConfig.config)
      db().set('appConfig', appConfig)

      // Return received config
      return appConfig
    })
    .catch((err) => {
      logger.error('Error getting remote config:', err)

      // Using cached version of the config
      const configFromDb = db().get<AppConfig | undefined>('appConfig')

      logger.info('Using cached config', db().all())

      if (!configFromDb) {
        throw new Error('Local config not found')
      }

      return configFromDb
    })

  // Assigning config to the exported variable
  appConfig = loadedConfig
  config = loadedConfig.config

  return appConfig
}
