export async function getSSL(): Promise<{
    cert: string
    key: string
}> {
    return await fetch(`${Deno.env.get('AUTH_SERVICE_URL')}/api/ssl`, {
        headers: {
            'x-client-api-key': Deno.env.get('CLIENT_API_KEY') as string,
        },
    }).then((res) => res.json())
}
