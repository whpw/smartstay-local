import ical from 'ical'

import { appConfig } from '@/config'
import { devices } from '@/devices'
import { logger } from '@/utils/logger'
import { TZDate } from '@date-fns/tz'
import { CronJob } from 'cron'
import { compareAsc, differenceInHours, isAfter, setHours } from 'date-fns'

export type Gap = {
  start: TZDate
  end: TZDate
  duration: number
}

export async function ecoMode() {
  // Logging
  logger.info('Checking eco mode...')

  // Getting iCal Data
  const icalData = await fetch(appConfig.icalUrl).then((res) => res.text())

  // Parsing ical
  const calendar = ical.parseICS(icalData)

  // Seen events
  const seen = new Set()

  // Getting current time
  const now = new TZDate(new Date(), appConfig.tz)

  // Getting next or current res
  const [nextRes] = Object.values(calendar)
    // Sanitize events first
    .filter((event) => !!event.start && !!event.end)
    .filter((event) => {
      const key = event.start!.toISOString() + event.end!.toISOString()
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
    .sort((a, b) => compareAsc(a.start as Date, b.start as Date))
    // Map to start and end with proper timezone
    .map((event) => ({
      start: setHours(
        new TZDate(event.start as Date, appConfig.tz),
        appConfig.checkinHour
      ),
      end: setHours(
        new TZDate(event.end as Date, appConfig.tz),
        appConfig.checkoutHour
      ),
    }))
    // Filter out past events
    .filter((event) => {
      return isAfter(event.end as Date, now)
    })

  // Return if no next reservation
  if (!nextRes) {
    logger.warn('Next reservation not found')
    return
  }

  // Calculating next reservation start
  const nextResStart = nextRes.start

  // Calculating gap in hours
  const gap = Math.max(differenceInHours(nextResStart, now), 0)

  // Getting device controller
  Object.values(devices).forEach((device) => {
    device.toggleEcoMode(gap).catch((e) => {
      device.logger.error('Error toggling eco mode:', e)
    })
  })
}

export function initEcoMode() {
  // Set interval for next runs
  const cronJob = CronJob.from({
    // Every hour
    cronTime: '0 0 * * * *',
    onTick: ecoMode,
    start: true,
    runOnInit: true,
  })

  // Logging next run
  logger.info(
    'Eco mode cron scheduled to run at: ' + cronJob.nextDate().toISO()
  )

  return () => cronJob.stop()
}
