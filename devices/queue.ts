import { getDeviceById, setDevice } from '@/devices/config.ts'
import { JacuzziConfig } from '@/model/device.ts'
import { terneoFetch } from '@/utils/terneo.ts'

const kv = await Deno.openKv()

export interface StopMessage {
    type: 'stop'
    deviceId: string
}

function isStopMessage(msg: unknown): msg is StopMessage {
    return typeof msg === 'object' && msg !== null && 'type' in msg &&
        msg.type === 'stop'
}

export function scheduleStop(deviceId: string, delay: number) {
    kv.enqueue({
        type: 'stop',
        deviceId,
    }, {
        delay,
    })
}

kv.listenQueue(async (msg: unknown) => {
    if (isStopMessage(msg)) {
        const device = await getDeviceById(msg.deviceId) as JacuzziConfig
        if (device) {
            console.log('Stopping device', device.id, new Date())

            // Setting idle state
            Object.assign(device, {
                sessionEnd: null,
                targetTemp: device.idleTemperature,
            })

            // Send stop command to device
            await terneoFetch(device, {
                par: [
                    // Setting schedule mode
                    [2, 2, '0'],
                    // Setting idle hysteresis
                    [
                        19,
                        2,
                        String(device.idleHysteresis),
                    ],
                ],
            })

            // Update device
            await setDevice(device)
        } else {
            console.log('Device not found', msg.deviceId)
        }
    }
})
