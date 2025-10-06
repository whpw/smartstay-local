import { TOTP } from 'totp-generator'

// const tz = { timeZone: 'Europe/Warsaw' }

export type TerneoDevice = {
  sn: string
  totp: string
  hostname: string
}

export async function terneoFetch(device: TerneoDevice, payload: object) {
  // Getting totp time
  const timeOffset = 30

  // console.log('Making request to Terneo device:', device, payload)

  // Generate a token (returns the current token as a string).
  const { otp, expires: time } = await TOTP.generate(device.totp, {
    digits: 9,
    period: timeOffset,
  })

  // const now = toDate(new Date(), tz)
  // const epoc = toDate(new Date(2000, 0, 1, 0, 0, 0, 0), tz)
  // const time = String(differenceInSeconds(now, epoc) + timeOffset)

  const data = JSON.stringify({
    sn: device.sn,
    time,
    auth: otp,
    ...payload,
  })

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
