import { getDevices, isJacuzziDevice, setDevice } from '@/devices/config.ts'
import { JacuzziConfig } from '@/model/device.ts'
import { terneoFetch } from '@/utils/terneo.ts'

export async function listenForUdpDevices() {
    const decoder = new TextDecoder()
    const listener = Deno.listenDatagram({
        port: 23500,
        transport: 'udp',
        hostname: '0.0.0.0',
    })

    console.log('UDP - listening for devices on port 23500')

    for await (let [data, address] of listener) {
        address = address as Deno.NetAddr

        const deviceInfo = {
            ...JSON.parse(decoder.decode(data)),
            ...address,
        } as JacuzziConfig

        const devices = await getDevices()

        const device = devices.find((device) =>
            isJacuzziDevice(device) && device.sn === deviceInfo.sn
        )

        if (device) {
            try {
                const telemetry = await terneoFetch(deviceInfo, { cmd: 4 })
                deviceInfo.currentTemp = Math.round(telemetry['t.1'] / 16)
            } catch (e) {
                console.error('UDP - telemetry error:', e)
            }

            if (device) {
                Object.assign(device, deviceInfo)
            }

            await setDevice(device)
        }
    }
}
