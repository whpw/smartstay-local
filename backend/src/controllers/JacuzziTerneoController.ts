import dgram from 'node:dgram'

import { addHours, differenceInSeconds } from 'date-fns'
import {
  actionBound,
  computed,
  observable,
  runInAction,
  toJS,
  when,
} from 'mobx'

import type { ResDetails } from '../models/ResDetails'
import type { QueueMessage } from '../queue'

import { db, toKey } from '@/db'
import {
  DevController,
  type GapInHours,
  type JacuzziTerneoConfig,
} from '@/devices/controller'
import {
  JacuzziActionType,
  type Action,
  type DeviceState,
  type JacuzziPersistentState,
  type JacuzziViewData,
} from '@/models'
import { Deferred } from '@/utils/Deferred'
import {
  enqueueStopSession,
  isStopMessageCurrent,
  reconcileLoadedSession,
} from '@/utils/reconcileSession'
import { cancelPendingMessages } from '@/queue'
import {
  canStartSession,
  incrementSessionsCount,
  isWithinStopGrace,
  refundSessionQuota,
} from '@/utils/sessions'
import { terneoFetch } from '@/utils/terneo'
import { waitUntilReady } from '@/utils/waitUntilReady'

export type TerneoUdpData = {
  sn: string
  hw: string
  cloud: string
  connection: string
  wifi: string
  display: string
}

const MINUTE = 60 * 1000

export class JacuzziTerneoController extends DevController<
  JacuzziTerneoConfig,
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

  private udpListener: dgram.Socket | null = null

  private statePollingInterval: NodeJS.Timeout | null = null

  @observable
  private accessor pollingError = false

  @observable
  private accessor terneoAddress!: string

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
      targetTemp: session ? session.targetTemp : this.config.idleTemp,
      defaultTemp: this.config.sessionTemp,
      minTemp: this.config.minTemp,
      maxTemp: this.config.maxTemp,
      sessionDuration: this.config.sessionDuration,
      pollingError: this.pollingError,
    }
  }

  public async init() {
    // Initialize UDP listener
    this.logger.info('Connecting to API via UDP discovery, sn=', this.config.sn)
    this.initUdpListener()

    // Wait for terneo address
    await when(() => !!this.terneoAddress)

    this.logger.info('Connected to API at:', this.terneoAddress)

    // Load current session
    await this.loadCurrentState()

    // Update device
    await this.updateDevice()

    // Initialize state polling
    await this.initStatePolling()
  }

  public dispose() {
    try {
      // Dispose of the controller
      this.udpListener?.close()
    } catch (error) {
      this.logger.error('Error disposing of controller:', error)
    }
    if (this.statePollingInterval) {
      clearInterval(this.statePollingInterval)
    }
  }

  public async processQueueMessage(msg: QueueMessage) {
    // Checking if message is for this device
    if (msg.deviceId === this.id && msg.action === 'stop-session') {
      await waitUntilReady(() => this.state !== 'initializing')
      if (
        !isStopMessageCurrent(
          msg.sessionEndTime,
          this.persistentState.session?.endTime,
        )
      ) {
        return
      }
      await this.stopSession()
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

          await this.startSession(res)
        }
        break
      case JacuzziActionType.STOP:
        {
          const session = this.persistentState.session
          if (!session) {
            break
          }
          if (session.refundableMode && isWithinStopGrace(session.startTime)) {
            refundSessionQuota(res, this.config.type, session.refundableMode)
          }
          cancelPendingMessages(this.config.id, 'stop-session')
          await this.stopSession()
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

  @actionBound
  public async startSession(res: ResDetails) {
    // Calculate max delay
    const maxDelay = new Date(res.departureDate).getTime() - Date.now()

    // Calculate delay in ms
    const delay = Math.max(
      Math.min(this.config.sessionDuration * MINUTE, maxDelay),
      0,
    )

    const quota = incrementSessionsCount(res, this.config.type)

    // Creating session object
    const session = {
      targetTemp: this.config.sessionTemp,
      startTime: Date.now(),
      endTime: Date.now() + delay,
      complimentary: quota.complimentary,
      refundableMode: quota.refundableMode,
    }

    // Creating state object
    const state: JacuzziPersistentState = {
      state: 'active',
      session,
    }

    enqueueStopSession(this.config.id, delay, session.endTime)

    db().set(toKey('device-state', this.config.id), state, delay)

    // Setting state
    this.persistentState = observable(state)

    // Start session
    await this.updateDevice(true)
  }

  @actionBound
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
      await this.updateDevice(true)
    }
  }

  @actionBound
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
    await this.updateDevice(true)
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
        // Calculating eco end
        const ecoEnd = differenceInSeconds(
          addHours(new Date(), gap - ecoModeTreshold),
          new Date('2000-01-01T00:00:00'),
        )
        // Enabling eco mode
        await terneoFetch(this.deviceConnection, {
          par: [
            // Enabling away mode
            [1, 6, String(ecoEnd)],
            // Setting eco temp
            [7, 1, String(ecoTemp)],
            // Setting eco hysteresis
            [19, 2, (ecoHysteresis * 10).toFixed(2)],
            // Making sure it's locked
            [124, 7, '1'],
          ],
        })

        // Setting state
        state = 'eco'
      } else {
        // Disabling eco mode
        await terneoFetch(this.deviceConnection, {
          par: [
            // Setting schedule mode
            [2, 2, '0'],
            // Disabling away mode
            [1, 6, '0'],
          ],
        })

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

  @actionBound
  private async loadCurrentState() {
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
      await this.stopSession()
      return
    }

    if (result.status === 'active') {
      db().set(toKey('device-state', this.config.id), state, result.remainingMs)
    }

    this.persistentState = observable(state)
  }

  private async updateDevice(skipScheduleUpdate = false) {
    // Getting session
    const { state, session } = this.persistentState

    // This doesn't work for eco mode
    if (state === 'eco') {
      return
    }

    // Setting current temp
    const targetTemp = session?.targetTemp ?? this.config.idleTemp
    const hysteresis = session
      ? this.config.sessionHysteresis
      : this.config.idleHysteresis

    // Terneo parameters
    const par = [
      // Setting schedule mode
      [2, 2, '0'],
      // Disabling away mode, just in case
      [1, 6, '0'],
      // Setting temp
      [29, 1, String(targetTemp)],
      // Setting active hysteresis
      [19, 2, (hysteresis * 10).toFixed(2)],
      // Making sure it's locked
      [124, 7, '1'],
    ]

    // Setting temps
    await terneoFetch(this.deviceConnection, {
      par,
    })

    // Setting idle schedule
    if (!skipScheduleUpdate) {
      await this.setTerneoSchedule(this.config.idleTemp)
    }
  }

  private get deviceConnection() {
    return {
      sn: this.config.sn,
      totp: this.config.totp,
      hostname: this.terneoAddress,
    }
  }

  private async setTerneoSchedule(temp: number) {
    for (let i = 0; i <= 6; i++) {
      await terneoFetch(this.deviceConnection, {
        tt: {
          [String(i)]: [[0, temp * 10]],
        },
      })
    }
  }

  private async initUdpListener() {
    // Creating deferred promise
    const def = new Deferred<void>()

    // Closing listener if it exists
    if (this.udpListener) {
      this.udpListener.close()
    }

    // Creating listener
    this.udpListener = dgram.createSocket('udp4')

    this.udpListener.once('message', (msg, rinfo) => {
      // Parsing udp data
      const terneoData: TerneoUdpData = JSON.parse(msg.toString())

      // Check if device is jacuzzi
      if (terneoData.sn === this.config.sn) {
        // Update state
        runInAction(() => {
          // Set terneo address
          this.terneoAddress = rinfo.address

          // Set current temp
          this.currentTemp = parseFloat(terneoData.display || '0')
        })
      } else {
        this.logger.debug('UDP - Skipping device', terneoData)
      }
    })

    // Initialize the socket
    this.udpListener.bind(23500)

    return def.promise
  }

  private async initStatePolling() {
    // Creating deferred promise
    let isFetching = false

    // Creating interval
    this.statePollingInterval = setInterval(() => {
      // Skip if device connection is not set or def is not resolved
      if (!this.deviceConnection || isFetching) return

      // Set fetching
      isFetching = true

      // Fetching state
      terneoFetch(this.deviceConnection, {
        cmd: 4,
      })
        .then((data) => {
          this.logger.debug('Polled from Terneo...')
          this.logger.debug('Polled target temp:', parseFloat(data['t.5']) / 16)
          this.logger.debug(
            'Polled current temp:',
            parseFloat(data['t.1']) / 16,
          )
          runInAction(() => {
            // Setting current temp, rounding it to closest 0.5
            this.currentTemp =
              Math.round((parseFloat(data['t.1']) / 16) * 2) / 2
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
        })
        .finally(() => {
          isFetching = false
        })
    }, 5000)
  }
}
