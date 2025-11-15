import ical from 'ical'

import { appConfig } from '@/config'
import { devices } from '@/devices'
import { logger } from '@/utils/logger'
import { TZDate } from '@date-fns/tz'
import { CronJob } from 'cron'
import { compareAsc, differenceInHours, setHours } from 'date-fns'

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

  // Getting entries
  const entries = Object.values(calendar)

  // Sorting events by start date
  const [event] = entries
    .sort((a, b) => compareAsc(a.start as Date, b.start as Date))
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

  if (!event) {
    logger.warn('No events found')
    return
  }

  const upcomingEvent = {
    start: setHours(
      new TZDate(event.start as Date, appConfig.tz),
      appConfig.checkinHour
    ),
    end: setHours(
      new TZDate(event.end as Date, appConfig.tz),
      appConfig.checkoutHour
    ),
  }

  // Getting current time
  const now = new TZDate(new Date(), appConfig.tz)

  // Calculating gap in hours
  const gap = Math.max(differenceInHours(upcomingEvent.start, now), 0)

  // Getting device controller
  Object.values(devices).forEach((device) => {
    device.toggleEcoMode(gap)
  })
}

export function initEcoMode() {
  // Set interval for next runs
  const interval = CronJob.from({
    // Every hour
    cronTime: '0 0 * * * *',
    onTick: ecoMode,
    start: true,
    runOnInit: true,
  })

  return () => interval.stop()
}
