import { JacuzziConfig } from '@/model/device.ts'
import { differenceInSeconds } from 'date-fns'
import { toDate } from 'date-fns-tz'
import * as OTPAuth from 'otpauth'

const tz = { timeZone: 'Europe/Warsaw' }

export async function terneoFetch(device: JacuzziConfig, payload: object) {
    // Create a new TOTP object.
    const totp = new OTPAuth.TOTP({
        digits: 9,
        period: 30,
        secret: device.totp,
    })

    // Generate a token (returns the current token as a string).
    const auth = totp.generate()

    // Getting totp time
    const timeOffset = 30

    const now = toDate(new Date(), tz)
    const epoc = toDate(new Date(2000, 0, 1, 0, 0, 0, 0), tz)
    const time = String(differenceInSeconds(now, epoc) + timeOffset)

    const data = JSON.stringify({
        sn: device.sn,
        time,
        auth,
        ...payload,
    })

    const cmd = new Deno.Command('curl', {
        args: [
            `http://${device.hostname}/api.cgi`,
            '-H "Content-Type: application/json"',
            `-d ${data}`,
        ],
    })
    const { stdout } = await cmd.output()
    return JSON.parse(new TextDecoder().decode(stdout))
}
