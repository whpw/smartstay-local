import { appConfig } from '@/config'
import { db } from '@/db'
import { logger } from '@/utils/logger'
import { TZDate } from '@date-fns/tz'
import { CronJob } from 'cron'
import { formatDate, parse } from 'date-fns'
import ky from 'ky'
import { observable, runInAction, toJS } from 'mobx'

const timeFormat = 'h:mm:ss aa'

// Observable sunset object
export const sunset = observable({
  start: new TZDate('1970-01-01T17:00:00', 'Europe/Warsaw'),
  end: new TZDate('1970-01-02T07:00:00', 'Europe/Warsaw'),
})

function setSunset(start: TZDate, end: TZDate) {
  // Setting sunset
  runInAction(() => {
    sunset.start = start
    sunset.end = end
  })
}

function checkSunset() {
  // Logging check sunset
  logger.info('Checking sunset...')

  if (!appConfig.sunsetUrl) {
    logger.warn('No sunset URL found')
    return
  }

  return ky
    .get<{ results: { sunrise: string; sunset: string }; tzid: string }>(
      appConfig.sunsetUrl,
      {
        searchParams: {
          lat: appConfig.lat,
          lng: appConfig.lng,
          date: formatDate(TZDate.tz(appConfig.tz), 'yyyy-MM-dd'),
        },
      }
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
      setSunset(
        new TZDate(sunsetStart, appConfig.tz),
        new TZDate(sunsetEnd, appConfig.tz)
      )

      // Setting sunset in db
      db().set('sunset', {
        start: sunsetStart.toISOString(),
        end: sunsetEnd.toISOString(),
      })

      // Logging initial sunset
      logger.info('Updated sunset times:', toJS(sunset))
    })
    .catch((err) => {
      logger.error('Error checking sunset:', err)
    })
}

export async function initSunset() {
  // try getting sunset from db
  const sunsetFromDb = db().get<{
    start: string
    end: string
  }>('sunset')

  // Setting initial sunset
  if (sunsetFromDb) {
    setSunset(
      new TZDate(sunsetFromDb.start, appConfig.tz),
      new TZDate(sunsetFromDb.end, appConfig.tz)
    )
    // Logging initial sunset
    logger.info('Initialized sunset times:', toJS(sunset))
  }

  // Init cron
  const cronJob = CronJob.from({
    cronTime: '0 0 0 * * *',
    timeZone: appConfig.tz,
    onTick: checkSunset,
    start: true,
  })

  // Logging next run
  logger.info('Sunset cron scheduled to run at: ' + cronJob.nextDate().toISO())

  await checkSunset()

  return () => cronJob.stop()
}
