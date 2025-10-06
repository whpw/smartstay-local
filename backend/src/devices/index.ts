import type { DeviceController } from '@/devices/controller'

import { config } from '@/config'
import { JacuzziController } from '@/controllers/JacuzziController'
import { SaunaController } from '@/controllers/SaunaController'

export const devices: Record<string, DeviceController> = {}

export async function initDevices() {
  //
  console.log('Initializing devices...')

  for (const device of config.devices) {
    let controller: DeviceController | undefined
    if (device.type === 'jacuzzi') {
      controller = new JacuzziController()
    } else if (device.type === 'sauna') {
      controller = new SaunaController()
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

  console.log('Devices initialized successfully')
}

export function getDeviceController(id: string): DeviceController {
  const device = devices[id]
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (!device) {
    throw new Error(`Device [${id}] not found`)
  }
  return device
}
