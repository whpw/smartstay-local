import { Handlers, RouteConfig } from '$fresh/server.ts'
import { getDeviceById } from '@/devices/config.ts'
import { JacuzziConfig } from '@/model/device.ts'
import { pick } from 'es-toolkit'

export const config: RouteConfig = {
    routeOverride: '/api/device/:id',
}

export const handler: Handlers = {
    async GET(_req, ctx) {
        const device = await getDeviceById<JacuzziConfig>(ctx.params.id)
        return new Response(
            JSON.stringify(
                pick(device || {}, [
                    'currentTemp',
                    'targetTemp',
                    'sessionEnd',
                    'minTemperature',
                    'maxTemperature',
                    'sessionDuration',
                ]),
            ),
        )
    },
}
