import ky from 'ky'

import { db } from '@/db'

const isDev = process.env.NODE_ENV === 'development'

export type DeviceConfig = {
  id: string
  type: string
}

export type AppConfig = {
  icalUrl: string
  devices: Array<DeviceConfig>
  checkinHour: number
  checkoutHour: number
  jwtSecret: string
  adminPassword: string
  objectSlug: string
  roomSlug: string
  roomId: string
  loginUrl: string
  hotresAuthCode: string
  hotresApiKey: string
  hotresAddonsUrl: string
  port: number
}

// Exporting initialized config
export let config!: AppConfig

// Exporting config initialization function
export async function initConfig() {
  console.log('Initializing config...')

  const CONFIG_API_URL = process.env.CONFIG_API_URL
  const CONFIG_API_KEY = process.env.CONFIG_API_KEY

  if (isDev) {
    const localConfig = db().get<AppConfig | undefined>('config')

    if (localConfig) {
      console.log('Local config initialized successfully')
      return localConfig
    }
  }

  // Get devices config
  const loadedConfig = await ky
    .get<AppConfig>(`${CONFIG_API_URL}/config`, {
      headers: {
        Authorization: `Bearer ${CONFIG_API_KEY}`,
      },
    })
    .json()
    .then(async (resConfig: AppConfig) => {
      console.log('Remote config initialized successfully')

      // Storing config
      await db().set('config', resConfig)
      // Return received config
      return resConfig
    })
    .catch((err) => {
      console.error('Error getting remote config:', err.message)

      // Using cached version of the config
      const configFromDb = db().get<AppConfig | undefined>('config')

      if (!configFromDb) {
        throw new Error('Local config not found')
      }

      console.log('Local config initialized successfully')

      return configFromDb
    })

  // Assigning config to the exported variable
  config = loadedConfig

  return config
}
