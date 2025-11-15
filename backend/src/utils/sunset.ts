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
export let sunset!: { start: TZDate; end: TZDate }

function checkSunset() {
  logger.debug('Checking sunset...')

  if (!appConfig.sunsetUrl) {
    logger.warn('No sunset URL found')
    return
  }

  ky.get<{ results: { sunrise: string; sunset: string }; tzid: string }>(
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
      runInAction(() => {
        sunset.start = new TZDate(sunsetStart, appConfig.tz)
        sunset.end = new TZDate(sunsetEnd, appConfig.tz)
      })

      logger.info('Updated sunset times:', toJS(sunset))

      // Setting sunset in db
      db().set('sunset', {
        start: sunsetStart.toISOString(),
        end: sunsetEnd.toISOString(),
      })
    })
    .catch((err) => {
      logger.error('Error checking sunset:', err)
    })
}

export function initSunset() {
  // try getting sunset from db
  const sunsetFromDb = db().get<{
    start: string
    end: string
  }>('sunset')

  // Setting initial sunset
  sunset = observable({
    start: sunsetFromDb
      ? new TZDate(sunsetFromDb.start, appConfig.tz)
      : new TZDate('1970-01-01T17:00:00', appConfig.tz),
    end: sunsetFromDb
      ? new TZDate(sunsetFromDb.end, appConfig.tz)
      : new TZDate('1970-01-02T07:00:00', appConfig.tz),
  })

  // Logging initial sunset
  logger.info('Loaded initial sunset:', toJS(sunset))

  // Init interval
  const interval = CronJob.from({
    cronTime: '0 0 0 * * *',
    timeZone: appConfig.tz,
    onTick: checkSunset,
    start: true,
    runOnInit: true,
  })

  return () => interval.stop()
}
