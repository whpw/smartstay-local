import { Handlers } from '$fresh/server.ts'

import { JacuzziConfig } from '@/model/device.ts'
import { terneoFetch } from '@/utils/terneo.ts'

const kv = await Deno.openKv()

export const handler: Handlers = {
  async GET(_req, _ctx) {
    const device = await kv.get<JacuzziConfig>([
      'devices',
      Deno.env.get('TERNEO_SN') as string,
    ])

    const deviceData = await terneoFetch(device.value as JacuzziConfig, {
      cmd: 4,
    })

    console.log('deviceData', deviceData)

    return new Response(JSON.stringify({
      temperature: 20,
    }))
  },
}
