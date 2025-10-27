import {
  action,
  computed,
  observable,
  reaction,
  runInAction,
  toJS,
  type IReactionDisposer,
} from 'mobx'

import type { ResDetails } from '../models/ResDetails'
import type { QueueMessage } from '../queue'

import { db, toKey } from '@/db'
import { DeviceController, type HeatingConfig } from '@/devices/controller'
import {
  JacuzziActionType,
  type Action,
  type DeviceState,
  type HeatingPersistentState,
  type HeatingViewData,
} from '@/models'
import { enqueueMessage } from '@/queue'
import { weather } from '@/utils/weather'
import { TZDate } from '@date-fns/tz'
import ky, { type KyInstance } from 'ky'

const TZ = process.env.TZ || 'Europe/Warsaw'

export class HeatingThermoBoxController extends DeviceController {
  //

  private config!: HeatingConfig

  @observable
  public accessor persistentState: HeatingPersistentState = {
    state: 'initializing',
    dayTemp: 0,
    nightTemp: 0,
  }

  @observable
  public accessor currentTemp = 0

  @observable
  public accessor targetTemp = 0

  private deviceApi!: KyInstance

  private dayPartInterval: NodeJS.Timeout | null = null

  private statePollingInterval: NodeJS.Timeout | null = null

  private weatherDisposer: IReactionDisposer | null = null

  @observable
  private accessor pollingError = false

  @computed
  public get state(): DeviceState {
    return this.persistentState.state
  }

  public override get id(): string {
    return this.config.id
  }

  public override get type(): string {
    return this.config.type
  }

  @computed
  public get viewData(): HeatingViewData {
    return {
      state: this.state,
      name: this.config.name,
      currentTemp: this.currentTemp,
      targetTemp: this.targetTemp,
      dayTemp: this.persistentState.dayTemp,
      nightTemp: this.persistentState.nightTemp,
      minTemp: this.config.minTemp,
      maxTemp: this.config.maxTemp,
      dayStart: this.config.dayStart,
      nightStart: this.config.nightStart,
      pollingError: this.pollingError,
    }
  }

  public async init(config: HeatingConfig) {
    // Setting config
    this.config = config

    // Initialize UDP listener
    await this.initDeviceApi()

    // Load current session
    await this.loadCurrentState()

    // Initialize state polling
    await this.initStatePolling()

    // Initialize weather monitoring
    this.initWeatherMonitoring()

    // Initialize day part interval
    this.initDayPartInterval()
  }

  private initWeatherMonitoring() {
    this.log('Initializing weather monitoring...')
    this.weatherDisposer = reaction(
      () => weather.averageTemp < this.config.externalTempLimit,
      (isEnabled) => {
        this.log('Weather monitoring changed:', isEnabled)
        if (isEnabled) {
          this.turnOn()
        } else {
          this.turnOff()
        }
      },
      {
        fireImmediately: true,
      }
    )
  }

  private async turnOn() {
    // Skipping if device is already active
    if (this.state === 'active') {
      return
    }

    // Creating active state based on current state
    const activeState = {
      ...toJS(this.persistentState),
      state: 'active',
    } as HeatingPersistentState

    // Saving idle state
    db().set(toKey('device-state', this.config.id), activeState)

    // Setting idle state
    runInAction(() => {
      this.persistentState = observable(activeState)
    })

    // Updating device
    await this.updateDevice()
  }

  private async turnOff() {
    // Skipping if device is already idle
    if (this.state === 'idle') {
      return
    }

    // Turning off thermostat
    await this.deviceApi.post('state', {
      json: {
        thermo: {
          state: 0,
        },
      },
    })

    // Creating idle state based on current state
    const idleState = {
      ...toJS(this.persistentState),
      state: 'idle',
    } as HeatingPersistentState

    // Saving idle state
    db().set(toKey('device-state', this.config.id), idleState)

    // Setting idle state
    runInAction(() => {
      this.persistentState = observable(idleState)
    })
  }

  public dispose() {
    if (this.statePollingInterval) {
      clearInterval(this.statePollingInterval)
    }
    if (this.dayPartInterval) {
      clearInterval(this.dayPartInterval)
    }

    if (this.weatherDisposer) {
      this.weatherDisposer()
    }
  }

  private initDayPartInterval() {
    this.log('Initializing day part interval...')
    this.dayPartInterval = setInterval(() => {
      this.updateDevice()
    }, 60_000)
  }

  public async processQueueMessage(_msg: QueueMessage) {}

  public async invokeAction(actionToInvoke: Action, res: ResDetails) {
    switch (actionToInvoke.type) {
      case JacuzziActionType.SET_TARGET_TEMP:
        {
          // Getting target temp
          const { dayTemp, nightTemp } = actionToInvoke.value as {
            dayTemp: number
            nightTemp: number
          }

          if (
            !isNaN(dayTemp) &&
            !isNaN(nightTemp) &&
            dayTemp >= this.config.minTemp &&
            dayTemp <= this.config.maxTemp &&
            nightTemp >= this.config.minTemp &&
            nightTemp <= this.config.maxTemp
          ) {
            await this.setDayPartTemp(dayTemp, nightTemp, res)
          } else {
            throw new Error('Invalid target temperature')
          }
        }
        break
    }

    return this.viewData
  }

  @action.bound
  public async setDayPartTemp(
    dayTemp: number,
    nightTemp: number,
    res: ResDetails
  ) {
    // Creating new state
    const newState = {
      state: 'active',
      dayTemp,
      nightTemp,
    } as HeatingPersistentState

    // Getting expire in
    const expireIn = new Date(res.departureDate).getTime() - Date.now()

    this.log(
      'Setting user defined temparatures:',
      res.firstName,
      res.lastName,
      res.number
    )
    this.log('Day temp:', dayTemp)
    this.log('Night temp:', nightTemp)
    this.log('Expires at:', new Date(res.departureDate))

    // Setting device state
    db().set(toKey('device-state', this.config.id), newState, expireIn)

    // Setting state
    this.persistentState = observable(newState)

    // Updating device
    await this.updateDevice()
  }

  @action.bound
  private loadCurrentState() {
    // Load current state
    const state = db().get<HeatingPersistentState>(
      toKey('device-state', this.config.id)
    ) || {
      state: 'active',
      dayTemp: this.config.dayTemp,
      nightTemp: this.config.nightTemp,
    }

    // Setting state
    this.persistentState = observable(state)

    // Update device
    return this.updateDevice()
  }

  private isNightNow() {
    const { dayStart, nightStart } = this.config

    const now = TZDate.tz(TZ)
    const hours = now.getHours()

    return hours >= nightStart && hours < dayStart
  }

  private async updateDevice() {
    // Getting session
    const { state, dayTemp, nightTemp } = this.persistentState

    // This doesn't work for eco mode or idle state
    if (state === 'eco' || state === 'idle') {
      return
    }

    // Setting current temp
    const targetTemp = this.isNightNow() ? nightTemp : dayTemp

    // Constructing json
    const json = {
      thermo: {
        state: 1,
        desiredTemp: targetTemp * 100,
      },
    }

    this.log('Updating device with:', json)

    // Setting desired temp
    const res = await this.deviceApi
      .post('state', {
        json,
      })
      .json()

    // Setting target temp
    runInAction(() => {
      this.targetTemp = targetTemp
    })

    this.log('Updated device response:', res)
  }

  private async initDeviceApi() {
    // Getting api url
    const apiUrl = `http://bbx-${this.config.sn}.local/info`

    this.log('Initializing API at:', apiUrl)

    // Getting info
    const { device } = await ky
      .get<{ device: { ip: string } }>(apiUrl, {
        retry: {
          retryOnTimeout: true,
          limit: Number.POSITIVE_INFINITY,
          backoffLimit: 15_000,
        },
      })
      .json()

    this.log('Found API at:', device.ip)

    // Setting device api
    this.deviceApi = ky.create({
      prefixUrl: `http://${device.ip}`,
    })
  }

  private async initStatePolling() {
    // Creating deferred promise
    let isFetching = false

    // Creating interval
    this.statePollingInterval = setInterval(() => {
      // Skip if device connection is not set or def is not resolved
      if (!this.deviceApi || isFetching) return

      // Set fetching
      isFetching = true

      this.deviceApi
        .get<{
          thermo: { state: number; desiredTemp: number }
          sensors: Array<{
            id: number
            type: 'temperature'
            value: number
            state: number
          }>
        }>('state')
        .json()
        .then(({ thermo, sensors }) => {
          // Getting sensor
          const sensor = sensors.find((s) => s.type === 'temperature')
          const targetTemp = thermo.desiredTemp / 100
          const currentTemp = (sensor?.value ?? 0) / 100

          runInAction(() => {
            // Setting current temp, rounding it to closest 0.5
            this.currentTemp = Math.round(currentTemp * 2) / 2
            // Setting polling error
            this.pollingError = false
          })
        })
        .catch((e) => {
          console.error('Error polling state:', e)
          runInAction(() => {
            // Setting polling error
            this.pollingError = true
          })

          // Reinitializing device api
          this.initDeviceApi()
        })
        .finally(() => {
          isFetching = false
        })
    }, 8000)
  }

  public override async toggleEcoMode(gap: number) {
    // This makes sense if gap is > 0
    if (gap > 0 && this.state !== 'initializing') {
      // Getting config
      const { ecoModeTreshold, ecoTemp } = this.config

      // Final state
      let state = 'active'

      // Getting config
      let dayTemp = this.config.dayTemp
      let nightTemp = this.config.nightTemp

      // Turn on eco mode
      if (gap > ecoModeTreshold) {
        // Setting desired temp
        await this.deviceApi.post('state', {
          json: {
            thermo: {
              state: 1,
              desiredTemp: ecoTemp * 100,
            },
          },
        })

        // Schedule eco mode end
        enqueueMessage(
          {
            deviceId: this.config.id,
            action: 'stop-eco',
          },
          gap - ecoModeTreshold
        )

        // Setting config
        dayTemp = ecoTemp
        nightTemp = ecoTemp

        // Setting state
        state = 'eco'
      }

      // Creating state object
      const newState = {
        state,
        dayTemp,
        nightTemp,
      } as HeatingPersistentState

      // Setting state
      db().set(toKey('device-state', this.config.id), newState)

      // Setting state
      this.persistentState = observable(newState)

      // Updating device
      await this.updateDevice()
    }
  }
}
