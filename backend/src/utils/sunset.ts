import { observable, runInAction } from 'mobx'

import { appConfig } from '@/config'
import { db } from '@/db'
import { logger } from '@/utils/logger'
import { TZDate } from '@date-fns/tz'
import { CronJob } from 'cron'
import { parse } from 'date-fns'
import ky from 'ky'

const timeFormat = 'h:mm:ss aa'

const TZ = process.env.TZ || 'Europe/Warsaw'

// try getting sunset from db
const sunsetFromDb = db().get<{
  start: string
  end: string
}>('sunset')

export const sunset = observable({
  start: sunsetFromDb
    ? sunsetFromDb.start
    : new TZDate('1970-01-01T17:00:00', TZ),
  end: sunsetFromDb ? sunsetFromDb.end : new TZDate('1970-01-01T22:00:00', TZ),
})

function checkSunset() {
  logger.debug('Checking sunset...')

  if (!appConfig.sunsetUrl) {
    logger.warn('No sunset URL found')
    return
  }

  ky.get<{ results: { sunrise: string; sunset: string }; tzid: string }>(
    appConfig.sunsetUrl
  )
    .json()
    .then((json) => {
      // Parsing sunset times
      const sunsetStart = parse(
        json.results.sunset,
        timeFormat,
        TZDate.tz(json.tzid)
      )
      const sunsetEnd = parse(
        json.results.sunrise,
        timeFormat,
        TZDate.tz(json.tzid)
      )

      // Setting sunset
      runInAction(() => {
        sunset.start = new TZDate(sunsetStart, TZ)
        sunset.end = new TZDate(sunsetEnd, TZ)
      })

      // Setting sunset in db
      db().set('sunset', {
        start: sunsetStart,
        end: sunsetEnd,
      })
    })
    .catch((err) => {
      logger.error('Error checking sunset:', err)
    })
}

export function initSunset() {
  const interval = CronJob.from({
    cronTime: '0 0 0 * * *',
    onTick: checkSunset,
    start: true,
    runOnInit: true,
  })

  return () => interval.stop()
}
