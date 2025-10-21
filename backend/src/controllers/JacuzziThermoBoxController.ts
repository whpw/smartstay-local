import { formatISO } from 'date-fns/formatISO'
import { action, computed, observable, runInAction, toJS, when } from 'mobx'

import type { ResDetails } from '../models/ResDetails'
import type { QueueMessage } from '../queue'

import { db, toKey } from '@/db'
import { DeviceController, type JacuzziConfig } from '@/devices/controller'
import {
  JacuzziActionType,
  type Action,
  type DeviceState,
  type JacuzziPersistentState,
  type JacuzziViewData,
} from '@/models'
import { enqueueMessage } from '@/queue'
import { canStartSession, incrementSessionsCount } from '@/utils/sessions'
import ky, { type KyInstance } from 'ky'

const MINUTE = 60 * 1000

export class JacuzziThermoBoxController extends DeviceController {
  //

  private config!: JacuzziConfig

  @observable
  public accessor persistentState: JacuzziPersistentState = {
    state: 'initializing',
    session: null,
  }

  @observable
  public accessor currentTemp = 0

  private deviceApi!: KyInstance

  private statePollingInterval: NodeJS.Timeout | null = null

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
  public get viewData(): JacuzziViewData {
    const session = toJS(this.persistentState.session ?? null)
    return {
      state: this.state,
      session,
      name: this.config.name,
      currentTemp: this.currentTemp,
      targetTemp: session ? session.targetTemp : this.config.idleTemp,
      defaultTemp: this.config.sessionTemp,
      minTemp: this.config.minTemp,
      maxTemp: this.config.maxTemp,
      sessionDuration: this.config.sessionDuration,
      pollingError: this.pollingError,
    }
  }

  public async init(config: JacuzziConfig) {
    // Setting config
    this.config = config

    // Initialize UDP listener
    await this.initDeviceApi()

    // Load current session
    await this.loadCurrentState()

    // Update device
    await this.updateDevice()

    // Initialize state polling
    await this.initStatePolling()
  }

  public dispose() {
    if (this.statePollingInterval) {
      clearInterval(this.statePollingInterval)
    }
  }

  public async processQueueMessage(msg: QueueMessage) {
    // Checking if message is for this device
    if (msg.deviceId === this.id) {
      switch (msg.action) {
        case 'stop-session':
          // Waiting for active state
          await when(() => this.state !== 'initializing')
          // Stop session
          await this.stopSession()
          break
        case 'stop-eco':
          // Waiting for active state
          await when(() => this.state !== 'initializing')
          // Stop session
          await this.stopSession()
          break
      }
    }
  }

  public async invokeAction(actionToInvoke: Action, res: ResDetails) {
    switch (actionToInvoke.type) {
      case JacuzziActionType.START:
        {
          // Getting current day
          const today = formatISO(new Date(), {
            representation: 'date',
          })

          // Checking if session can be started
          if (!(await canStartSession(res, today, this.config.type))) {
            return {
              error: 'REACHED_LIMIT',
            }
          }

          // Starting session
          await this.startSession(res.departureDate)

          // Increment sessions count
          await incrementSessionsCount(res, today, this.config.type)
        }
        break
      case JacuzziActionType.SET_TARGET_TEMP:
        {
          const targetTemp = parseFloat(actionToInvoke.value as string)
          if (!isNaN(targetTemp)) {
            await this.setSessionTemp(targetTemp)
          } else {
            throw new Error('Invalid target temperature')
          }
        }
        break
    }

    return this.viewData
  }

  @action.bound
  public async startSession(departureDate: string) {
    // Calculate max delay
    const maxDelay = new Date(departureDate).getTime() - Date.now()

    // Calculate delay in ms
    const delay = Math.max(
      Math.min(this.config.sessionDuration * MINUTE, maxDelay),
      0
    )

    // Creating session object
    const session = {
      targetTemp: this.config.sessionTemp,
      startTime: Date.now(),
      endTime: Date.now() + delay,
    }

    // Creating state object
    const state: JacuzziPersistentState = {
      state: 'active',
      session,
    }

    // Enqueue message to stop session
    db().set(toKey('device-state', this.config.id), state)

    // Enqueue message to stop session
    enqueueMessage(
      {
        deviceId: this.config.id,
        action: 'stop-session',
      },
      delay
    )

    // Setting state
    this.persistentState = observable(state)

    // Start session
    await this.updateDevice()
  }

  @action.bound
  public async setSessionTemp(temp: number) {
    const { session } = this.persistentState
    if (session && temp >= this.config.minTemp && temp <= this.config.maxTemp) {
      // Setting session
      db().set(toKey('device-state', this.config.id), {
        state: 'active',
        session: toJS(session),
      })

      // Setting target temp
      session.targetTemp = temp

      // Updating device
      await this.updateDevice()
    }
  }

  @action.bound
  public async stopSession() {
    // Creating state object
    const state: JacuzziPersistentState = {
      state: 'idle',
      session: null,
    }

    // Setting state
    db().set(toKey('device-state', this.config.id), state)

    // Setting state
    this.persistentState = observable(state)

    // Updating device after session was cleared
    await this.updateDevice()
  }

  public override async toggleEcoMode(gap: number) {
    // This makes sense if gap is > 0
    if (gap > 0 && this.state !== 'initializing') {
      // Getting config
      const { ecoModeTreshold, ecoTemp, ecoHysteresis } = this.config

      // Final state
      let state = 'idle'

      // Turn on eco mode
      if (gap > ecoModeTreshold) {
        // Setting hysteresis (has to be first, for some reason it doesn't work otherwise)
        await this.updateHysteresis(ecoHysteresis)

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

        // Setting state
        state = 'eco'
      } else {
        // Setting state
        state = 'idle'
      }

      // Creating state object
      const newState = {
        state,
        session: null,
      } as JacuzziPersistentState

      // Setting state
      db().set(toKey('device-state', this.config.id), newState)

      // Setting state
      this.persistentState = observable(newState)

      // Updating device
      await this.updateDevice()
    }
  }

  @action.bound
  private loadCurrentState() {
    // Load current state
    const state = db().get<JacuzziPersistentState>(
      toKey('device-state', this.config.id)
    ) || {
      state: 'idle',
      session: null,
    }

    // Setting state
    this.persistentState = observable(state)
  }

  private async updateDevice() {
    // Getting session
    const { state, session } = this.persistentState

    // This doesn't work for eco mode
    if (state === 'eco') {
      return
    }

    // Getting hysteresis
    const hysteresis = session
      ? this.config.sessionHysteresis
      : this.config.idleHysteresis

    // Setting hysteresis (has to be first, for some reason it doesn't work otherwise)
    await this.updateHysteresis(hysteresis)

    // Setting current temp
    const targetTemp = session?.targetTemp ?? this.config.idleTemp

    // Constructing json
    const json = {
      thermo: {
        state: 1,
        desiredTemp: targetTemp * 100,
      },
    }

    console.log('Updating ThermoBox with:', json)

    // Setting desired temp
    const res = await this.deviceApi
      .post('state', {
        json,
      })
      .json()

    console.log('Updated ThermoBox response:', res)
  }

  private async updateHysteresis(hysteresis: number) {
    // Setting hysteresis
    await this.deviceApi.post('api/settings/set', {
      json: {
        settings: {
          thermo: {
            hysteresisWindow: [hysteresis * -10, 0],
          },
        },
      },
    })
  }

  private async initDeviceApi() {
    // Getting info
    const { device } = await ky
      .get<{ device: { ip: string } }>(
        `http://bbx-${this.config.sn}.local/info`
      )
      .json()

    console.log('Found ThermoBox device at:', device.ip)

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

          console.log('Polled from ThermoBox...')
          console.log('Polled target temp:', targetTemp)
          console.log('Polled current temp:', currentTemp)

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
        })
        .finally(() => {
          isFetching = false
        })
    }, 8000)
  }
}
