import ical from 'ical'

import { config } from '@/config'
import { devices } from '@/devices'
import { TZDate } from '@date-fns/tz'
import {
  addHours,
  compareAsc,
  differenceInHours,
  differenceInMilliseconds,
  setHours,
  setMilliseconds,
  setMinutes,
  setSeconds,
} from 'date-fns'

export type Gap = {
  start: TZDate
  end: TZDate
  duration: number
}

// Calculate first start
const nextHour = setMinutes(
  setSeconds(setMilliseconds(addHours(new Date(), 1), 0), 0),
  0
)
const untilNextHour = differenceInMilliseconds(nextHour, new Date())

// Set timeout for first run
setTimeout(() => {
  // Set interval for next runs
  setInterval(() => {
    ecoMode().catch((e) => {
      console.error('Error checking eco mode:', e)
    })
  }, 60 * 60 * 1000)
}, untilNextHour)

export async function ecoMode() {
  // Logging
  console.log('Checking eco mode...')

  // Getting timezone
  const tz = process.env.TZ || 'Europe/Warsaw'

  // Getting iCal Data
  const icalData = await fetch(config.icalUrl).then((res) => res.text())

  // Parsing ical
  const calendar = ical.parseICS(icalData)

  // Getting entries
  const entries = Object.values(calendar)

  // Sorting events by start date
  const [event] = entries
    .sort((a, b) => compareAsc(a.start as Date, b.start as Date))
    .map((event) => ({
      start: setHours(new TZDate(event.start as Date, tz), config.checkinHour),
      end: setHours(new TZDate(event.end as Date, tz), config.checkoutHour),
    }))

  if (!event) {
    console.log('No events found')
    return
  }

  const upcomingEvent = {
    start: setHours(new TZDate(event.start as Date, tz), config.checkinHour),
    end: setHours(new TZDate(event.end as Date, tz), config.checkoutHour),
  }

  // Getting current time
  const now = new TZDate(new Date(), tz)

  // Calculating gap in hours
  const gap = Math.max(differenceInHours(upcomingEvent.start, now), 0)

  // Getting device controller
  Object.values(devices).forEach((device) => {
    device.toggleEcoMode(gap)
  })
}
