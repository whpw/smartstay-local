import { action, computed, observable, runInAction, toJS } from 'mobx'

import type { ResDetails } from '../models/ResDetails'
import type { QueueMessage } from '../queue'

import { weather } from '@/cron/weather'
import { db, toKey } from '@/db'
import {
  DevController,
  type GapInHours,
  type JacuzziConfig,
} from '@/devices/controller'
import {
  JacuzziActionType,
  type Action,
  type DeviceState,
  type JacuzziPersistentState,
  type JacuzziViewData,
} from '@/models'
import {
  enqueueStopEco,
  enqueueStopSession,
  isStopMessageCurrent,
  reconcileLoadedSession,
} from '@/utils/reconcileSession'
import { canStartSession, incrementSessionsCount } from '@/utils/sessions'
import { waitUntilReady } from '@/utils/waitUntilReady'
import { hoursToMilliseconds } from 'date-fns'
import ky, { type KyInstance } from 'ky'

const MINUTE = 60 * 1000

export class JacuzziThermoBoxController extends DevController<
  JacuzziConfig,
  JacuzziViewData
> {
  //

  @observable
  public accessor persistentState: JacuzziPersistentState = {
    state: 'initializing',
    session: null,
  }

  @observable
  public accessor currentTemp = 0

  private deviceApi!: KyInstance

  private statePollingInterval: NodeJS.Timeout | null = null

  private discoveryAbort?: AbortController

  private discoveryPromise: Promise<void> | null = null

  @observable
  private accessor pollingError = false

  @computed
  public get state(): DeviceState {
    return this.persistentState.state
  }

  @computed
  public get viewData() {
    const session = toJS(this.persistentState.session ?? null)
    return {
      state: this.state,
      session,
      name: this.config.name,
      currentTemp: this.currentTemp,
      targetTemp: this.targetTemp,
      defaultTemp: this.defaultTemp,
      minTemp: this.config.minTemp,
      maxTemp: this.config.maxTemp,
      sessionDuration: this.config.sessionDuration,
      pollingError: this.pollingError,
    }
  }

  @computed
  public get targetTemp(): number {
    const { session } = this.persistentState
    if (session) {
      return session.targetTemp
    }
    return this.idleTemp
  }

  @computed
  public get defaultTemp(): number {
    if (weather.averageTemp < this.config.lowTempThreshold) {
      return this.config.lowTempDefault
    } else if (weather.averageTemp < this.config.midTempThreshold) {
      return this.config.midTempDefault
    } else {
      return this.config.highTempDefault
    }
  }

  @computed
  public get idleTemp(): number {
    if (weather.averageTemp < this.config.lowTempThreshold) {
      return this.config.lowTempIdleDefault
    } else if (weather.averageTemp < this.config.midTempThreshold) {
      return this.config.midTempIdleDefault
    } else {
      return this.config.highTempDefault
    }
  }

  public async init() {
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
    this.discoveryAbort?.abort()
    if (this.statePollingInterval) {
      clearInterval(this.statePollingInterval)
    }
  }

  public async processQueueMessage(msg: QueueMessage) {
    // Checking if message is for this device
    if (msg.deviceId === this.id) {
      switch (msg.action) {
        case 'stop-session':
          await waitUntilReady(() => this.state !== 'initializing')
          if (
            !isStopMessageCurrent(
              msg.sessionEndTime,
              this.persistentState.session?.endTime,
            )
          ) {
            break
          }
          await this.stopSession()
          break
        case 'stop-eco':
          await waitUntilReady(() => this.state !== 'initializing')
          await this.stopSession()
          break
      }
    }
  }

  public async invokeAction(actionToInvoke: Action, res: ResDetails) {
    switch (actionToInvoke.type) {
      case JacuzziActionType.START:
        {
          // Checking if session can be started
          if (!(await canStartSession(res, this.config.type))) {
            return {
              error: 'REACHED_LIMIT',
            }
          }

          // Starting session
          await this.startSession(res.departureDate)

          // Increment sessions count
          incrementSessionsCount(res, this.config.type)
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
  public startSession(departureDate: string) {
    // Calculate max delay
    const maxDelay = new Date(departureDate).getTime() - Date.now()

    // Calculate delay in ms
    const delay = Math.max(
      Math.min(this.config.sessionDuration * MINUTE, maxDelay),
      0
    )

    // Creating session object
    const session = {
      targetTemp: this.defaultTemp,
      startTime: Date.now(),
      endTime: Date.now() + delay,
    }

    // Creating state object
    const state: JacuzziPersistentState = {
      state: 'active',
      session,
    }

    enqueueStopSession(this.config.id, delay, session.endTime)

    return this.updateState(state, delay)
  }

  @action.bound
  public async setSessionTemp(temp: number) {
    const { session } = this.persistentState
    if (session && temp >= this.config.minTemp && temp <= this.config.maxTemp) {
      const remainingMs = Math.max(session.endTime - Date.now(), 0)

      // Setting target temp
      session.targetTemp = temp

      // Setting session (preserve remaining TTL)
      db().set(
        toKey('device-state', this.config.id),
        {
          state: 'active',
          session: toJS(session),
        },
        remainingMs,
      )

      // Updating device
      await this.updateDevice()
    }
  }

  @action.bound
  public stopSession() {
    // Creating idle state
    const idleState: JacuzziPersistentState = {
      state: 'idle',
      session: null,
    }
    return this.updateState(idleState)
  }

  @action.bound
  private loadCurrentState() {
    // Load current state
    const state = db().get<JacuzziPersistentState>(
      toKey('device-state', this.config.id),
    ) || {
      state: 'idle',
      session: null,
    }

    const result = reconcileLoadedSession({
      deviceId: this.config.id,
      state: state.state,
      session: state.session,
    })

    if (result.status === 'expired') {
      return this.stopSession()
    }

    if (result.status === 'active') {
      return this.updateState(state, result.remainingMs)
    }

    return this.updateState(state)
  }

  @action.bound
  private updateState(value: JacuzziPersistentState, expireIn?: number) {
    // Setting state
    this.persistentState = observable(value)

    // Setting state
    db().set(toKey('device-state', this.config.id), value, expireIn)

    // Updating device
    return this.updateDevice()
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
      ? this.config.activeHysteresis
      : this.config.idleHysteresis

    // Setting hysteresis (has to be first, for some reason it doesn't work otherwise)
    await this.updateHysteresis(hysteresis)

    // Setting current temp
    const targetTemp = session?.targetTemp ?? this.idleTemp

    // Constructing json
    const json = {
      thermo: {
        state: 1,
        desiredTemp: targetTemp * 100,
      },
    }

    this.logger.debug('Updating device with:', json.thermo)

    // Setting desired temp
    const res = await this.deviceApi
      .post<{ thermo: object; badges: object; sensors: object }>('state', {
        json,
      })
      .json()

    this.logger.debug('Updated device response:', res.thermo)
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
    if (this.discoveryPromise) {
      return this.discoveryPromise
    }

    const abort = new AbortController()
    this.discoveryAbort = abort
    const isReconnect = !!this.deviceApi

    this.discoveryPromise = (async () => {
      const apiUrl = `http://bbx-${this.config.sn}.local/info`

      if (isReconnect) {
        this.logger.warn('Reconnecting to API at:', apiUrl)
      } else {
        this.logger.info('Connecting to API at:', apiUrl)
      }

      const { device } = await ky
        .get<{ device: { ip: string } }>(apiUrl, {
          signal: abort.signal,
          retry: {
            retryOnTimeout: true,
            limit: Number.POSITIVE_INFINITY,
          },
          hooks: {
            beforeRetry: [
              ({ error, retryCount }) => {
                this.logger.warn(
                  'Failed to connect to API, retrying:',
                  apiUrl,
                  'attempt=',
                  retryCount,
                  error,
                )
              },
            ],
          },
        })
        .json()

      this.logger.info('Connected to API at:', device.ip)

      this.deviceApi = ky.create({
        prefixUrl: `http://${device.ip}`,
      })
    })().finally(() => {
      if (this.discoveryAbort === abort) {
        this.discoveryPromise = null
      }
    })

    return this.discoveryPromise
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
        .then(({ sensors }) => {
          // Getting sensor
          const sensor = sensors.find((s) => s.type === 'temperature')
          const currentTemp = (sensor?.value ?? 0) / 100

          runInAction(() => {
            // Setting current temp, rounding it to closest 0.5
            this.currentTemp = Math.round(currentTemp * 2) / 2
            // Setting polling error
            this.pollingError = false
          })
        })
        .catch((e) => {
          this.logger.error('Error polling state:', e)
          runInAction(() => {
            // Setting polling error
            this.pollingError = true
          })

          // Reinitializing device api
          void this.initDeviceApi()
        })
        .finally(() => {
          isFetching = false
        })
    }, 8000)
  }

  public override async toggleEcoMode(gap: GapInHours) {
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
        enqueueStopEco(
          this.config.id,
          hoursToMilliseconds(gap - ecoModeTreshold),
        )

        // Setting state
        state = 'eco'
      }

      // Creating state object
      const newState = {
        state,
        session: null,
      } as JacuzziPersistentState

      // Setting state
      await this.updateState(newState)
    }
  }
}
