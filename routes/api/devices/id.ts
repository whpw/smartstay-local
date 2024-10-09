import { Handlers, RouteConfig } from '$fresh/server.ts'
import { getDevices } from '@/devices/config.ts'

export const config: RouteConfig = {
    routeOverride: '/api/device/:id',
}

export const handler: Handlers = {
    async GET(_req, ctx) {
        const devices = await getDevices()

        const device = devices.find((device) => device.id === ctx.params.id)

        return new Response(JSON.stringify(device || null))
    },
}
