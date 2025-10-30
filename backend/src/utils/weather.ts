import { observable, runInAction } from 'mobx'

import { appConfig } from '@/config'
import { db } from '@/db'
import ky from 'ky'

export const weather = observable({
  averageTemp: 0,
})

function checkWeather() {
  console.log('Checking weather...')
  if (!appConfig.weatherUrl) {
    console.warn('No weather URL found')
    return
  }
  ky.get<
    Array<{ temperatura_powietrza: string; temperatura_powietrza_data: string }>
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
        db().set('temps', temps)

        // Calculating average temp
        const averageTemp =
          temps.reduce((acc, item) => acc + item, 0) / temps.length

        console.log('Setting average weather temp:', averageTemp)

        // Setting average temp
        runInAction(() => {
          weather.averageTemp = averageTemp
        })
      }
    })
    .catch((err) => {
      console.error('Error checking weather:', err)
    })
}

export function initWeather() {
  const interval = setInterval(checkWeather, 60 * 60_000)
  checkWeather()
  return () => clearInterval(interval)
}
