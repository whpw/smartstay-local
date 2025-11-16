import { appConfig } from '@/config'
import { db } from '@/db'
import { logger } from '@/utils/logger'
import { CronJob } from 'cron'
import ky from 'ky'
import { observable, runInAction } from 'mobx'

export const weather = observable({
  averageTemp: 0,
})

function setTemps(temps: Array<number>) {
  // Setting average temp
  runInAction(() => {
    weather.averageTemp =
      temps.reduce((acc, item) => acc + item, 0) / temps.length
  })
}

function checkWeather() {
  // Logging check weather
  logger.info('Checking weather...')

  if (!appConfig.weatherUrl) {
    logger.warn('No weather URL found')
    return
  }

  return ky
    .get<
      Array<{
        temperatura_powietrza: string
        temperatura_powietrza_data: string
      }>
    >(appConfig.weatherUrl)
    .json()
    .then(([item]) => {
      const temp = parseFloat(item.temperatura_powietrza)
      if (!isNaN(temp)) {
        // Getting temps
        const temps = db().get<Array<number>>('temps') || []
        // Adding new temp
        temps.push(temp)
        // Keep last 24 temps
        temps.splice(0, temps.length - 24)

        // Setting temps
        setTemps(temps)

        // Storing temps
        db().set('temps', temps)

        // Logging average temp
        logger.info('Updated average weather temp:', weather, '℃')
      }
    })
    .catch((err) => {
      logger.error('Error checking weather:', err)
    })
}

export async function initWeather() {
  // Getting temps from db
  const temps = db().get<Array<number>>('temps') || []
  // Setting temps from db
  setTemps(temps)
  // Logging average temp
  logger.info('Initialized average weather temp:', weather, '℃')

  // Init interval
  const cronJob = CronJob.from({
    // Every hour
    cronTime: '0 0 * * * *',
    onTick: checkWeather,
    start: true,
  })

  // Logging next run
  logger.info('Weather cron scheduled to run at: ' + cronJob.nextDate().toISO())

  // Check weather
  await checkWeather()

  return () => cronJob.stop()
}
