import { action, computed, observable, runInAction, toJS } from 'mobx'

import type { ResDetails } from '../models/ResDetails'
import type { QueueMessage } from '../queue'

import {
  DevController,
  type GapInHours,
  type LightSwitchConfig,
} from '@/devices/controller'
import {
  SwitchBoxActionType,
  type Action,
  type DeviceState,
  type SwitchBoxViewData,
} from '@/models'

import { appConfig } from '@/config'
import { sunset } from '@/cron/sunset'
import { db, toKey } from '@/db'
import { cancelPendingMessages, hasPendingMessage } from '@/queue'
import { enqueueStopSession, isStopMessageCurrent } from '@/utils/reconcileSession'
import { waitUntilReady } from '@/utils/waitUntilReady'
import { TZDate } from '@date-fns/tz'
import { CronJob, CronTime } from 'cron'
import {
  addMinutes,
  addSeconds,
  isAfter,
  max,
  parse,
  set,
} from 'date-fns'
import ky, { type KyInstance } from 'ky'

type LightPersistentState = {
  manualOffAt: number | null
}

function getScheduledTime(cron?: CronJob) {
  return (
    (cron && cron.isActive && cron.cronTime.sendAt().toJSDate()) || undefined
  )
}

export class LightSwitchController extends DevController<
  LightSwitchConfig,
  SwitchBoxViewData
> {
  @observable
  public accessor state: DeviceState = 'initializing'

  private deviceApi!: KyInstance

  private relayId?: number

  private isEcoMode = false

  private dayScheduleInterval?: CronJob

  private turnOnSchedule?: CronJob

  private turnOffSchedule?: CronJob

  private statePollingInterval: NodeJS.Timeout | null = null

  private discoveryAbort?: AbortController

  private discoveryPromise: Promise<void> | null = null

  @observable
  private accessor pollingError = false

  @computed
  public get viewData() {
    return {
      state: this.state,
      name: this.config.name,
      pollingError: this.pollingError,
      turnsOnAt: getScheduledTime(this.turnOnSchedule),
      turnsOffAt: getScheduledTime(this.turnOffSchedule),
    }
  }

  public async init() {
    await this.initDeviceApi()
    await this.reconcileManualSession()
    await this.initStatePolling()
    await this.initSchedule()
  }

  public dispose() {
    this.discoveryAbort?.abort()
    if (this.statePollingInterval) {
      clearInterval(this.statePollingInterval)
    }
    if (this.dayScheduleInterval) {
      this.dayScheduleInterval.stop()
    }
    if (this.turnOnSchedule) {
      this.turnOnSchedule.stop()
    }
    if (this.turnOffSchedule) {
      this.turnOffSchedule.stop()
    }
  }

  private initSchedule() {
    const { sunsetMode } = this.config
    if (sunsetMode) {
      this.logger.info('Initializing sunset mode...')

      this.dayScheduleInterval = CronJob.from({
        cronTime: '0 0 0 * * *',
        timeZone: appConfig.tz,
        onTick: () => {
          const now = addSeconds(TZDate.tz(appConfig.tz), 5)

          const endTime = parse(
            sunsetMode.turnOffAt,
            'HH:mm',
            TZDate.tz(appConfig.tz),
          )

          if (isAfter(now, endTime)) {
            return
          }

          this.logger.info(
            'Calculating start time from sunset:',
            toJS(sunset),
            sunsetMode,
          )

          const todayStart = set(TZDate.tz(appConfig.tz), {
            hours: sunset.start.getHours(),
            minutes: sunset.start.getMinutes(),
            seconds: sunset.start.getSeconds(),
            milliseconds: sunset.start.getMilliseconds(),
          })

          const startTime = max([
            now,
            addMinutes(todayStart, sunsetMode.turnOnShift),
          ])

          this.logger.info('Setting day schedule...', {
            startTime,
            endTime,
          })

          this.turnOnSchedule?.stop()
          this.turnOffSchedule?.stop()

          this.turnOnSchedule = CronJob.from({
            cronTime: startTime,
            onTick: () => {
              if (this.isEcoMode) {
                return
              }
              this.setDeviceState('active')
            },
            start: true,
          })

          this.turnOffSchedule = CronJob.from({
            cronTime: endTime,
            onTick: () => {
              this.setDeviceState('idle')
            },
            start: true,
          })
        },
        start: true,
        runOnInit: true,
      })
    }
  }

  public async processQueueMessage(msg: QueueMessage) {
    if (msg.deviceId === this.id && msg.action === 'stop-session') {
      await waitUntilReady(() => this.state !== 'initializing')
      const persisted = db().get<LightPersistentState>(this.persistentKey)
      if (
        !isStopMessageCurrent(msg.sessionEndTime, persisted?.manualOffAt)
      ) {
        return
      }
      this.clearManualOffAt()
      await this.setDeviceState('idle')
    }
  }

  @action.bound
  public async invokeAction(actionToInvoke: Action, _res: ResDetails) {
    switch (actionToInvoke.type) {
      case SwitchBoxActionType.START:
        {
          await this.setDeviceState('active')

          const offTime = addMinutes(new Date(), this.config.sessionDuration)
          const delay = Math.max(offTime.getTime() - Date.now(), 0)

          this.persistManualOffAt(offTime.getTime(), delay)
          enqueueStopSession(this.config.id, delay, offTime.getTime())

          // If manual off is after the sunset turn-off, extend the sunset window
          const sunsetOffTime = getScheduledTime(this.turnOffSchedule)
          if (sunsetOffTime && isAfter(offTime, sunsetOffTime)) {
            this.turnOffSchedule?.setTime(new CronTime(offTime))
          }
        }
        break
      case SwitchBoxActionType.STOP:
        {
          cancelPendingMessages(this.config.id, 'stop-session')
          this.clearManualOffAt()
          await this.setDeviceState('idle')
        }
        break
    }

    return this.viewData
  }

  private get persistentKey() {
    return toKey('device-state', this.config.id)
  }

  private persistManualOffAt(manualOffAt: number, ttlMs: number) {
    const state: LightPersistentState = { manualOffAt }
    db().set(this.persistentKey, state, ttlMs)
  }

  private clearManualOffAt() {
    db().set(this.persistentKey, { manualOffAt: null } satisfies LightPersistentState)
  }

  private async reconcileManualSession() {
    const persisted = db().get<LightPersistentState>(this.persistentKey) || {
      manualOffAt: null,
    }

    if (!persisted.manualOffAt) {
      return
    }

    const remainingMs = persisted.manualOffAt - Date.now()

    if (remainingMs <= 0) {
      this.clearManualOffAt()
      await this.setDeviceState('idle')
      return
    }

    if (!hasPendingMessage(this.config.id, 'stop-session')) {
      enqueueStopSession(this.config.id, remainingMs, persisted.manualOffAt)
    }
  }

  private setDeviceState(state: DeviceState) {
    this.logger.debug('Setting state to:', state)
    return this.deviceApi
      .post('state', {
        json: {
          relays: [
            {
              relay: this.relayId!,
              state: state === 'active' ? 1 : 0,
            },
          ],
        },
      })
      .then(() => {
        runInAction(() => {
          this.state = state
        })
      })
      .catch((e) => {
        this.logger.error('Error setting state:', e)
        runInAction(() => {
          this.pollingError = true
        })
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
            backoffLimit: 15_000,
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

      const {
        relays: [relay],
      } = await this.deviceApi
        .get<{ relays: Array<{ relay: number; state: 0 | 1 }> }>('state', {
          signal: abort.signal,
        })
        .json()

      if (!relay) {
        throw new Error('No relays found')
      }

      this.relayId = relay.relay
      runInAction(() => {
        this.state = relay.state === 1 ? 'active' : 'idle'
      })
    })().finally(() => {
      if (this.discoveryAbort === abort) {
        this.discoveryPromise = null
      }
    })

    return this.discoveryPromise
  }

  private async initStatePolling() {
    let isFetching = false

    this.statePollingInterval = setInterval(() => {
      if (!this.deviceApi || isFetching) return

      isFetching = true

      this.deviceApi
        .get<{
          relays: Array<{ relay: number; state: 0 | 1 }>
        }>('state')
        .json()
        .then(({ relays: [relay] }) => {
          if (!relay) {
            this.logger.error('No relays found')
            return
          }

          runInAction(() => {
            this.relayId = relay.relay
            this.state = relay.state === 1 ? 'active' : 'idle'
          })
        })
        .catch((e) => {
          this.logger.error('Error polling state:', e)
          runInAction(() => {
            this.pollingError = true
          })

          void this.initDeviceApi()
        })
        .finally(() => {
          isFetching = false
        })
    }, 15_000)
  }

  public override async toggleEcoMode(tillNextResInHrs: GapInHours) {
    this.isEcoMode = tillNextResInHrs > 12
  }
}
