import type {
  DeviceController,
  HeatingConfig,
  JacuzziConfig,
} from '@/devices/controller'

import { config } from '@/config'
import {
  HeatingThermoBoxController,
  JacuzziThermoBoxController,
} from '@/controllers'
import { JacuzziTerneoController } from '@/controllers/JacuzziTerneoController'
import { SaunaController } from '@/controllers/SaunaController'
import { SwitchBoxController } from '@/controllers/SwitchBoxController'

export const devices: Record<string, DeviceController> = {}

export async function initDevices() {
  //
  console.log('Initializing devices...')

  for (const device of config.devices) {
    let controller: DeviceController | undefined

    if (device.disabled) {
      console.log(
        'Device [',
        device.id,
        '] is disabled, skipping initialization'
      )
      continue
    }

    if (
      device.type === 'jacuzzi' &&
      (device as JacuzziConfig).thermostat === 'terneo'
    ) {
      controller = new JacuzziTerneoController()
    } else if (
      device.type === 'jacuzzi' &&
      (device as JacuzziConfig).thermostat === 'thermobox'
    ) {
      controller = new JacuzziThermoBoxController()
    } else if (
      device.type === 'heating' &&
      (device as HeatingConfig).thermostat === 'thermobox'
    ) {
      controller = new HeatingThermoBoxController()
    } else if (device.type === 'sauna') {
      controller = new SaunaController()
    } else if (device.type === 'light-switch') {
      controller = new SwitchBoxController()
    }
    if (controller) {
      // Adding controller to the map
      devices[device.id] = controller
      controller
        .init(device)
        .then(() => {
          console.log('Device [', device.id, '] initialized successfully')
        })
        .catch((err) => {
          console.error('Error initializing device', device.id, err)
        })
    }
  }
}

export function getDeviceController(id: string): DeviceController {
  const device = devices[id]
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!device) {
    throw new Error(`Device [${id}] not found`)
  }
  return device
}
