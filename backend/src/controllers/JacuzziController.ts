import dgram from 'node:dgram'

import { addHours, differenceInSeconds } from 'date-fns'
import { formatISO } from 'date-fns/formatISO'
import { action, computed, observable, runInAction, toJS, when } from 'mobx'

import type { DeviceConfig } from '@/config'
import type { Action, DeviceViewData } from '@/devices/controller'
import type { QueueMessage } from '@/queue'
import type { ResDetails } from '@/utils/ResDetails'

import { db, toKey } from '@/db'
import { DeviceController } from '@/devices/controller'
import { enqueueMessage } from '@/queue'
import { Deferred } from '@/utils/Deferred'
import { canStartSession, incrementSessionsCount } from '@/utils/sessions'
import { terneoFetch } from '@/utils/terneo'

const MINUTE = 60 * 1000

export type JacuzziState = 'initializing' | 'idle' | 'active' | 'eco'

export type JacuzziPersistentState = {
  state: JacuzziState
  session: JacuzziSession | null
}

export type JacuzziSession = {
  targetTemp: number
  startTime: number
  endTime: number
}

export type JacuzziConfig = {
  sn: string
  totp: string

  // Duration in minutes
  sessionDuration: number
  sessionTemp: number
  sessionHysteresis: number

  ecoTemp: number
  ecoHysteresis: number
  ecoModeTreshold: number

  idleTemp: number
  idleHysteresis: number
  minTemp: number
  maxTemp: number
} & DeviceConfig

export type TerneoUdpData = {
  sn: string
  hw: string
  cloud: string
  connection: string
  wifi: string
  display: string
}

export type JacuzziViewData = DeviceViewData & {
  state: JacuzziState
  session: JacuzziSession | null
  currentTemp: string
  targetTemp: string
  minTemp: number
  maxTemp: number
  sessionDuration: number
}

export enum JacuzziActionType {
  START = 'START',
  SET_TARGET_TEMP = 'SET_TARGET_TEMP',
}

export class JacuzziController extends DeviceController {
  //

  private config!: JacuzziConfig

  @observable
  public accessor persistentState: JacuzziPersistentState = {
    state: 'initializing',
    session: null,
  }

  @observable
  public accessor currentTemp = ''

  private udpListener: dgram.Socket | null = null

  @observable
  private accessor terneoAddress!: string

  @computed
  public get state(): JacuzziState {
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
      currentTemp: this.currentTemp,
      targetTemp: session
        ? String(session.targetTemp)
        : String(this.config.idleTemp),
      minTemp: this.config.minTemp,
      maxTemp: this.config.maxTemp,
      sessionDuration: this.config.sessionDuration,
    }
  }

  public async init(config: JacuzziConfig) {
    // Setting config
    this.config = config

    // Initialize UDP listener
    this.initUdpListener()

    // Wait for terneo address
    await when(() => !!this.terneoAddress)

    // Load current session
    await this.loadCurrentState()

    // Update device
    await this.updateDevice()
  }

  public dispose() {
    try {
      // Dispose of the controller
      this.udpListener?.close()
    } catch (error) {
      console.error('Error disposing of controller:', error)
    }
  }

  public async processQueueMessage(msg: QueueMessage) {
    // Checking if message is for this device
    if (msg.deviceId === this.id && msg.action === 'stop-session') {
      // Waiting for active state
      await when(() => this.state !== 'initializing')
      // Stop session
      await this.stopSession()
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
    await this.updateDevice(true)
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
      await this.updateDevice(true)
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
    await this.updateDevice(true)
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
        // Calculating eco end
        const ecoEnd = differenceInSeconds(
          addHours(new Date(), gap - ecoModeTreshold),
          new Date('2000-01-01T00:00:00')
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

  private async updateDevice(skipScheduleUpdate = false) {
    // Getting session
    const { state, session } = this.persistentState

    // This doesn't work for eco mode
    if (state === 'eco') {
      return
    }

    // Setting current temp
    const currentTemp = session?.targetTemp ?? this.config.idleTemp
    const hysteresis = session
      ? this.config.sessionHysteresis
      : this.config.idleHysteresis

    // Terneo parameters
    const par = [
      // Disabling away mode, just in case
      [1, 6, '0'],
      // Setting temp
      [29, 1, String(currentTemp)],
      // Setting active hysteresis
      [19, 2, (hysteresis * 10).toFixed(2)],
      // Making sure it's locked
      [124, 7, '1'],

      // Setting schedule mode
      [2, 2, '0'],
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

    this.udpListener.on('message', (msg, rinfo) => {
      // Parsing udp data
      const terneoData: TerneoUdpData = JSON.parse(msg.toString())

      // Check if device is jacuzzi
      if (terneoData.sn === this.config.sn) {
        // Update state
        runInAction(() => {
          // Set terneo address
          this.terneoAddress = rinfo.address

          // Set current temp
          this.currentTemp = terneoData.display
        })
      } else {
        console.log('UDP - Skipping device', terneoData)
      }
    })

    this.udpListener.on('error', (err) => {
      console.error('[TerneoController] udp client error:', err)
    })

    this.udpListener.on('listening', () => {
      console.log('[TerneoController] udp client listening')
      def.resolve()
    })

    // Initialize the socket
    this.udpListener.bind(23500)

    return def.promise
  }
}
