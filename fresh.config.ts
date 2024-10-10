import tailwind from '$fresh/plugins/tailwind.ts'
import { defineConfig } from '$fresh/server.ts'

import { listenForUdpDevices } from '@/devices/udp.ts'
import { i18nHandle } from '@/i18next-config.ts'
import { getRemoteConfig } from '@/utils/getRemoteConfig.ts'
import { i18nextPlugin } from '@/utils/i18next-plugin.ts'

// Get hostname from env
const hostname = `${
  Deno.env.get('CLIENT_SUBDOMAIN')
}.lewybrzegnarwi.smartstay.app`

// Get port from env or use 443
const port = Number(Deno.env.get('PORT')) || 443

// Get remote config
const config = await getRemoteConfig()

// Listen for UDP devices
listenForUdpDevices()

console.log('\nStarting server at:', `https://${hostname}:${port}\n`)

export default defineConfig({
  server: {
    port,
    cert: config.ssl.cert,
    key: config.ssl.key,
    hostname: '0.0.0.0',
  },
  plugins: [tailwind(), i18nextPlugin({ i18nHandle })],
})
