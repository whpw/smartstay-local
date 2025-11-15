import { db } from '@/db'
import { logger } from '@/utils/logger'
import ky from 'ky'
import z from 'zod'

export const $DeviceType = z.enum([
  'sauna',
  'jacuzzi',
  'heating',
  'light-switch',
])
export type DeviceType = z.infer<typeof $DeviceType>

export type DeviceConfig = {
  id: string
  type: DeviceType
  name: string
  disabled: boolean
}

export type AppConfig = {
  objectName: string
  apiKey: string
  weatherUrl: string
  sunsetUrl: string
  lat: number
  lng: number
  tz: string
  icalUrl: string
  checkinHour: number
  checkoutHour: number
  loginUrl: string
  hotresRoomId: string
  hotresAuthCode: string
  hotresApiKey: string
  hotresAddonsUrl: string
  devices: Array<DeviceConfig>
  wifi: {
    name: string
    ssid: string
    pwd: string
    ip: string
  }
}

// Exporting initialized config
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
      db().set('appConfig', appConfig)

      // Return received config
      return appConfig
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

  // Assigning config to the exported variable
  appConfig = loadedConfig

  return appConfig
}
