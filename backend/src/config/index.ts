import ky from 'ky'

import { db } from '@/db'

const isDev = process.env.NODE_ENV === 'development'

export type DeviceConfig = {
  id: string
  type: string
  name: string
}

export type Config = {
  icalUrl: string
  checkinHour: number
  checkoutHour: number
  jwtSecret: string
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
  console.log('Initializing config...')

  const CONFIG_API_URL = process.env.CONFIG_API_URL as string
  const CONFIG_API_KEY = process.env.CONFIG_API_KEY as string
  const CONFIG_API_INPUT = process.env.CONFIG_API_INPUT as string

  if (isDev) {
    const localConfig = db().get<AppConfig | undefined>('config')

    if (localConfig) {
      console.log('Local config initialized successfully')
      return localConfig
    }
  }

  // Get devices config
  const loadedConfig = await ky
    .get<{ result: { data: AppConfig } }>(CONFIG_API_URL, {
      headers: {
        Authorization: `Bearer ${CONFIG_API_KEY}`,
      },
      searchParams: {
        input: CONFIG_API_INPUT,
      },
    })
    .json()
    .then(({ result: { data: appConfig } }) => {
      console.log('Remote config initialized successfully', appConfig)

      // Storing config
      db().set('config', appConfig.config)
      db().set('appConfig', appConfig)

      // Return received config
      return appConfig
    })
    .catch((err) => {
      console.error('Error getting remote config:', err.message)

      // Using cached version of the config
      const configFromDb = db().get<AppConfig | undefined>('appConfig')

      if (!configFromDb) {
        throw new Error('Local config not found')
      }

      console.log('Local config initialized successfully')

      return configFromDb
    })

  // Assigning config to the exported variable
  appConfig = loadedConfig
  config = loadedConfig.config

  return appConfig
}
