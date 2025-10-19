import { TZDate } from '@date-fns/tz'
import { differenceInSeconds } from 'date-fns'
import { TOTP } from 'totp-generator'

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

  console.log('Terneo request:', data)

  return await fetch(`http://${device.hostname}/api.cgi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: data,
  })
    .then((res) =>
      res.text().then((text) => {
        try {
          return text ? JSON.parse(text) : {}
        } catch (error) {
          console.error('Error parsing Terneo response:', text)
          return Promise.reject(error)
        }
      })
    )
    .catch((error) => {
      console.error('Error calling Terneo device:', error)
      console.error('Failed request payload:', payload)
      return Promise.reject(error)
    })
}
