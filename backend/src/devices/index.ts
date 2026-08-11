import type {
  DevController,
  HeatingConfig,
  JacuzziConfig,
  JacuzziTerneoConfig,
  LightSwitchConfig,
  SaunaConfig,
} from '@/devices/controller'

import { appConfig } from '@/config'
import type { DeviceConfig } from '@/config/types'
import {
  HeatingThermoBoxController,
  JacuzziThermoBoxController,
} from '@/controllers'
import { JacuzziTerneoController } from '@/controllers/JacuzziTerneoController'
import { LightSwitchController } from '@/controllers/LightSwitchController'
import { SaunaBoxController } from '@/controllers/SaunaBoxController'
import { SaunaController } from '@/controllers/SaunaController'
import type { DeviceViewData } from '@/models'
import { logger } from '@/utils/logger'

export const devices: Record<
  string,
  DevController<DeviceConfig, DeviceViewData>
> = {}

export async function initDevices() {
  logger.info('Initializing devices...')

  const initTasks: Array<Promise<void>> = []

  for (const device of appConfig.devices) {
    let controller: DevController<DeviceConfig, DeviceViewData> | undefined

    if (device.disabled) {
      logger.warn(
        'Device [',
        device.id,
        '] is disabled, skipping initialization',
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
      // saunabox → hardware controller; anything else (minimal / manual / thermobox) → timer UI
      if ((config as SaunaConfig).thermostat === 'saunabox') {
        controller = new SaunaBoxController(config as SaunaConfig)
      } else {
        controller = new SaunaController(config as SaunaConfig)
      }
    } else if (device.type === 'light-switch') {
      controller = new LightSwitchController(config as LightSwitchConfig)
    }

    if (controller) {
      const deviceController = controller
      // Register immediately so the queue can resolve the controller while
      // hardware discovery (which may retry indefinitely) is still running.
      devices[device.id] = deviceController

      logger.info(
        'Starting init for device [',
        device.id,
        '] type=',
        device.type,
        'name=',
        device.name,
      )

      initTasks.push(
        deviceController
          .init()
          .then(() => {
            logger.info('Device [', device.id, '] initialized successfully')
          })
          .catch((err) => {
            logger.error('Error initializing device', device, err)
          }),
      )
    } else {
      logger.warn(
        'No controller for device [',
        device.id,
        '] type=',
        device.type,
      )
    }
  }

  // Do not block server boot on hardware discovery (can retry forever).
  // Queue handlers already wait for state !== 'initializing' where needed.
  void Promise.allSettled(initTasks)
}

export function getDeviceController(
  id: string,
): DevController<DeviceConfig, DeviceViewData> {
  const device = devices[id]
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!device) {
    throw new Error(`Device [${id}] not found`)
  }
  return device
}
