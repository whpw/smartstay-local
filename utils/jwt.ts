import { create, Payload, verify } from 'https://deno.land/x/djwt@v3.0.2/mod.ts'

let key: CryptoKey | null = null
async function getKey() {
    if (key) {
        return key
    }
    key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(Deno.env.get('JWT_SECRET')!),
        {
            name: 'HMAC',
            hash: { name: 'SHA-256' },
        },
        false,
        ['sign', 'verify'],
    )
    return key
}

export async function createJwt(payload: Payload) {
    return await create({ alg: 'HS256', typ: 'JWT' }, payload, await getKey())
}

export async function validateJwt(jwt: string) {
    return await verify(jwt, await getKey())
}
