import { TZDate } from '@date-fns/tz'
import { differenceInSeconds } from 'date-fns'
import child_process from 'node:child_process'
import { promisify } from 'node:util'
import { TOTP } from 'totp-generator'

const exec = promisify(child_process.exec)

export type TerneoDevice = {
  sn: string
  totp: string
  hostname: string
}

export async function terneoFetch(device: TerneoDevice, payload: object) {
  // Getting totp time
  const timeOffset = 30

  // Generate a token (returns the current token as a string).
  const { otp, expires } = await TOTP.generate(device.totp, {
    digits: 9,
    period: timeOffset,
  })

  // Calculate time
  const epoc = new TZDate('2000-01-01T00:00:00', 'Europe/Warsaw')
  const time = String(differenceInSeconds(expires, epoc))

  // Creating request data
  const data = JSON.stringify({
    sn: device.sn,
    time,
    auth: otp,
    ...payload,
  })

  const cmd = `curl -X POST -H 'Content-Type: application/json' -d '${data}' http://${device.hostname}/api.cgi`

  return exec(cmd)
    .then(({ stdout, stderr }) => {
      // if (stderr) {
      //   throw new Error(stderr)
      // }
      try {
        return JSON.parse(stdout)
      } catch (error) {
        console.error('Error parsing Terneo device response:', stdout, stderr)
        console.error('Failed request command:', cmd)
        throw error
      }
    })
    .catch((error) => {
      console.error('Error calling Terneo device:', error)
      console.error('Failed request payload:', payload)
      return Promise.reject(error)
    })
}
