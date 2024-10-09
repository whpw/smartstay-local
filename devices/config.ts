import { DeviceConfig, JacuzziConfig } from '@/model/device.ts'

const kv = await Deno.openKv()

export const getDevices = async () => {
    const devicesRes = await kv.list<DeviceConfig>({
        prefix: ['devices'],
    })
    const devices = []
    for await (const device of devicesRes) {
        devices.push(device.value)
    }
    return devices
}

export function getDeviceById<T extends DeviceConfig>(id: string) {
    return kv.get<DeviceConfig>(['devices', id]).then((res) => res.value as T)
}

export function isJacuzziDevice(device: DeviceConfig): device is JacuzziConfig {
    return device.type === 'jacuzzi'
}

export function setDevice<T extends DeviceConfig>(device: T) {
    return kv.set(['devices', device.id], device)
}
