import { getNetworkAddr } from 'local_ip'
import { retry } from 'retry'

interface SSL {
    key: string
    cert: string
}

interface RoomConfig {
    id: string
    ip: string
    lastLogin: Date
    ssl: SSL
}

export async function getRemoteConfig(): Promise<RoomConfig> {
    console.log('Getting remote config...')

    // Getting local ip address
    const ip = await getNetworkAddr()

    // Fetching remote config
    return await retry(async () => {
        return await fetch(`${Deno.env.get('AUTH_SERVICE_URL')}/api/config`, {
            method: 'POST',
            body: JSON.stringify({
                ip,
                roomId: Deno.env.get('CLIENT_SUBDOMAIN'),
            }),
            headers: {
                'x-client-api-key': Deno.env.get('CLIENT_API_KEY') as string,
            },
        }).then((res) => res.json())
    }, {
        delay: 30_000,
        maxTry: 10,
    })
}
