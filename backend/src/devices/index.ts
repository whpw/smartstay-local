import type {
  DevController,
  HeatingConfig,
  JacuzziConfig,
  JacuzziTerneoConfig,
  LightSwitchConfig,
  SaunaConfig,
} from '@/devices/controller'

import { config, type DeviceConfig } from '@/config'
import {
  HeatingThermoBoxController,
  JacuzziThermoBoxController,
} from '@/controllers'
import { JacuzziTerneoController } from '@/controllers/JacuzziTerneoController'
import { LightSwitchController } from '@/controllers/LightSwitchController'
import { SaunaController } from '@/controllers/SaunaController'
import type { DeviceViewData } from '@/models'
import { logger } from '@/utils/logger'

export const devices: Record<
  string,
  DevController<DeviceConfig, DeviceViewData>
> = {}

export async function initDevices() {
  //
  logger.info('Initializing devices...')

  for (const device of config.devices) {
    let controller: DevController<DeviceConfig, DeviceViewData> | undefined

    if (device.disabled) {
      logger.warn(
        'Device [',
        device.id,
        '] is disabled, skipping initialization'
      )
      continue
    }

    const config = device as DeviceConfig

    if (
      config.type === 'jacuzzi' &&
      (config as JacuzziConfig).thermostat === 'terneo'
    ) {
      controller = new JacuzziTerneoController(config as JacuzziTerneoConfig)
    } else if (
      config.type === 'jacuzzi' &&
      (config as JacuzziConfig).thermostat === 'thermobox'
    ) {
      controller = new JacuzziThermoBoxController(config as JacuzziConfig)
    } else if (
      device.type === 'heating' &&
      (device as HeatingConfig).thermostat === 'thermobox'
    ) {
      controller = new HeatingThermoBoxController(config as HeatingConfig)
    } else if (device.type === 'sauna') {
      controller = new SaunaController(config as SaunaConfig)
    } else if (device.type === 'light-switch') {
      controller = new LightSwitchController(config as LightSwitchConfig)
    }
    if (controller) {
      // Adding controller to the map
      devices[device.id] = controller
      controller
        .init()
        .then(() => {
          logger.info('Device [', device.id, '] initialized successfully')
        })
        .catch((err) => {
          logger.error('Error initializing device', device.id, err)
        })
    }
  }
}

export function getDeviceController(
  id: string
): DevController<DeviceConfig, DeviceViewData> {
  const device = devices[id]
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!device) {
    throw new Error(`Device [${id}] not found`)
  }
  return device
}
