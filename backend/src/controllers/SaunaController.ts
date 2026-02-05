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

import { db, toKey } from '@/db'
import { DevController, type SaunaConfig } from '@/devices/controller'
import { enqueueMessage } from '@/queue'
import { canStartSession, incrementSessionsCount } from '@/utils/sessions'

const MINUTE = 60 * 1000

export class SaunaController extends DevController<SaunaConfig, SaunaViewData> {
  //

  @observable
  public accessor persistentState: SaunaPersistentState = {
    state: 'idle',
    session: null,
  }

  @observable
  public accessor currentTemp = 0

  @computed
  public get state(): DeviceState {
    return this.persistentState.state
  }

  @computed
  public get viewData() {
    const session = toJS(this.persistentState.session ?? null)
    return {
      name: this.config.name,
      state: this.state,
      session,
      currentTemp: this.currentTemp,
      sessionDuration: this.config.sessionDuration,
      thermostat: this.config.thermostat,
      targetTemp: 0,
      defaultTemp: this.config.defaultTemp,
      minTemp: this.config.minTemp,
      maxTemp: this.config.maxTemp,
      pollingError: false,
    }
  }

  public async init() {
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
      startTime: Date.now(),
      endTime: Date.now() + delay,
      targetTemp: 0,
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
      delay,
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
      toKey('device-state', this.config.id),
    ) || {
      state: 'idle',
      session: null,
    }
    // Setting state
    this.persistentState = observable(state)
  }
}
