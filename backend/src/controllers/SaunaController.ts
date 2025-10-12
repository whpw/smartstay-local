import { formatISO } from 'date-fns/formatISO'
import { action, computed, observable, toJS } from 'mobx'

import {
  SaunaActionType,
  type Action,
  type DeviceState,
  type SaunaPersistentState,
  type SaunaViewData,
} from '@/models'
import type { ResDetails } from '@/models/ResDetails'
import type { QueueMessage } from '@/queue'

import type { DeviceConfig } from '@/config'
import { db, toKey } from '@/db'
import { DeviceController } from '@/devices/controller'
import { enqueueMessage } from '@/queue'
import { canStartSession, incrementSessionsCount } from '@/utils/sessions'

export type SaunaConfig = {
  // Duration in minutes
  sessionDuration: number
} & DeviceConfig

const MINUTE = 60 * 1000

export class SaunaController extends DeviceController {
  //

  private config!: SaunaConfig

  @observable
  public accessor persistentState: SaunaPersistentState = {
    state: 'idle',
    session: null,
  }

  @observable
  public accessor currentTemp = ''

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
  public get viewData(): SaunaViewData {
    const session = toJS(this.persistentState.session ?? null)
    return {
      state: this.state,
      session,
      currentTemp: this.currentTemp,
      sessionDuration: this.config.sessionDuration,
    }
  }

  public async init(config: SaunaConfig) {
    // Setting config
    this.config = config

    // Load current session
    await this.loadCurrentState()
  }

  public dispose() {
    // Dispose of the controller
  }

  public async processQueueMessage(msg: QueueMessage) {
    // Checking if message is for this device
    if (msg.deviceId === this.id && msg.action === 'stop-session') {
      // Stop session
      await this.stopSession()
    }
  }

  public async invokeAction(actionToInvoke: Action, res: ResDetails) {
    switch (actionToInvoke.type) {
      case SaunaActionType.START:
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
      startTime: Date.now(),
      endTime: Date.now() + delay,
    }

    // Creating state object
    const state: SaunaPersistentState = {
      state: 'active',
      session,
    }

    // Setting state
    this.persistentState = observable(state)

    // Setting state
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
  }

  @action.bound
  public stopSession() {
    // Creating state object
    const state: SaunaPersistentState = {
      state: 'idle',
      session: null,
    }

    // Setting state
    this.persistentState = observable(state)

    // Setting state
    db().set(toKey('device-state', this.config.id), state)
  }

  @action.bound
  private loadCurrentState() {
    // Load current state
    const state: SaunaPersistentState = db().get<SaunaPersistentState>(
      toKey('device-state', this.config.id)
    ) || {
      state: 'idle',
      session: null,
    }
    // Setting state
    this.persistentState = observable(state)
  }
}
