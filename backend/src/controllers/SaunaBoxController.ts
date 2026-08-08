import { action, computed, observable, runInAction, toJS } from 'mobx'

import type { ResDetails } from '../models/ResDetails'
import type { QueueMessage } from '../queue'

import { db, toKey } from '@/db'
import { DevController, type SaunaConfig } from '@/devices/controller'
import {
  SaunaActionType,
  type Action,
  type DeviceState,
  type JacuzziPersistentState,
  type SaunaPersistentState,
  type SaunaViewData,
} from '@/models'
import { cancelPendingMessages } from '@/queue'
import {
  enqueueStopSession,
  isStopMessageCurrent,
  reconcileLoadedSession,
} from '@/utils/reconcileSession'
import { canStartSession, incrementSessionsCount } from '@/utils/sessions'
import { waitUntilReady } from '@/utils/waitUntilReady'
import ky, { type KyInstance } from 'ky'

const MINUTE = 60 * 1000

export class SaunaBoxController extends DevController<
  SaunaConfig,
  SaunaViewData
> {
  //

  @observable
  public accessor persistentState: SaunaPersistentState = {
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
      sessionDuration: this.config.sessionDuration,
      pollingError: this.pollingError,
      minTemp: this.config.minTemp,
      maxTemp: this.config.maxTemp,
      thermostat: this.config.thermostat,
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
    return this.config.defaultTemp
  }

  @computed
  public get idleTemp(): number {
    return 0
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
      }
    }
  }

  public async invokeAction(actionToInvoke: Action, res: ResDetails) {
    switch (actionToInvoke.type) {
      case SaunaActionType.START:
        {
          if (this.state === 'initializing' || this.pollingError) {
            return {
              error: 'NOT_READY',
            }
          }

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
      case SaunaActionType.STOP:
        {
          cancelPendingMessages(this.config.id, 'stop-session')
          await this.stopSession()
        }
        break
      case SaunaActionType.SET_TARGET_TEMP:
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
      0,
    )

    // Creating session object
    const session = {
      targetTemp: this.defaultTemp,
      startTime: Date.now(),
      endTime: Date.now() + delay,
    }

    // Creating state object
    const state: SaunaPersistentState = {
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

    const targetState = state === 'active' ? 's/1' : 's/0'
    const targetTemp = (session?.targetTemp ?? this.idleTemp) * 100

    await this.deviceApi.get(targetState)
    const tempRes = await this.deviceApi.get(`s/t/${targetTemp}`).json()

    this.logger.debug('Updating device with:', tempRes)
  }

  private async initDeviceApi() {
    if (this.discoveryPromise) {
      return this.discoveryPromise
    }

    const abort = new AbortController()
    this.discoveryAbort = abort
    const isReconnect = !!this.deviceApi

    this.discoveryPromise = (async () => {
      const url = `http://${this.config.ip}`

      const api = ky.create({
        prefixUrl: url,
      })

      if (isReconnect) {
        this.logger.warn('Reconnecting to API at:', url)
      } else {
        this.logger.info('Connecting to API at:', url)
      }

      const { device } = await api
        .get<{ device: { id: string } }>('api/device/state', {
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
                  url,
                  'attempt=',
                  retryCount,
                  error,
                )
              },
            ],
          },
        })
        .json()

      this.logger.info('Connected to API at:', url, 'id=', device.id)

      this.deviceApi = api
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
          heat: {
            state: number
            desiredTemp: number
            sensors: Array<{
              id: number
              type: 'temperature'
              value: number
              state: number
            }>
          }
        }>('api/heat/state')
        .json()
        .then(({ heat: { sensors } }) => {
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
}
