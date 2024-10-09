import tailwind from '$fresh/plugins/tailwind.ts'
import { defineConfig } from '$fresh/server.ts'

import { listenForUdpDevices } from '@/devices/udp.ts'
import { i18nHandle } from '@/i18next-config.ts'
import { i18nextPlugin } from '@/utils/i18next-plugin.ts'

listenForUdpDevices()

export default defineConfig({
  server: {
    port: Number(Deno.env.get('PORT')),
  },
  plugins: [tailwind(), i18nextPlugin({ i18nHandle })],
})
