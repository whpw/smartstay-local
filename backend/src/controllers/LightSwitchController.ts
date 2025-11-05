import { action, computed, observable, runInAction } from 'mobx'

import type { ResDetails } from '../models/ResDetails'
import type { QueueMessage } from '../queue'

import { DevController, type LightSwitchConfig } from '@/devices/controller'
import {
  SwitchBoxActionType,
  type Action,
  type DeviceState,
  type SwitchBoxViewData,
} from '@/models'

import { sunset } from '@/utils/sunset'
import { CronJob, CronTime } from 'cron'
import { addMinutes, addSeconds, isAfter, isBefore, max, parse } from 'date-fns'
import ky, { type KyInstance } from 'ky'

function getScheduledTime(cron?: CronJob) {
  return (
    (cron && cron.isActive && cron.cronTime.sendAt().toJSDate()) || undefined
  )
}

export class LightSwitchController extends DevController<
  LightSwitchConfig,
  SwitchBoxViewData
> {
  //

  @observable
  public accessor state: DeviceState = 'initializing'

  private deviceApi!: KyInstance

  private relayId?: number

  private isEcoMode = false

  private dayScheduleInterval?: CronJob

  private turnOnSchedule?: CronJob

  private turnOffSchedule?: CronJob

  private manualTurnOffSchedule?: CronJob

  private statePollingInterval: NodeJS.Timeout | null = null

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
    // Initialize UDP listener
    await this.initDeviceApi()

    // Initialize state polling
    await this.initStatePolling()

    // Initialize schedule
    await this.initSchedule()
  }

  public dispose() {
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
    if (this.manualTurnOffSchedule) {
      this.manualTurnOffSchedule.stop()
    }
  }

  private initSchedule() {
    const { sunsetMode } = this.config
    if (sunsetMode) {
      this.logger.info('Initializing sunset mode...')

      // Scheduling day schedule
      this.dayScheduleInterval = CronJob.from({
        cronTime: '0 0 0 * * *',
        onTick: () => {
          // Adding 5 seconds to avoid cron job execution error
          const now = addSeconds(new Date(), 5)

          // Parsing end time
          const endTime = parse(sunsetMode.turnOffAt, 'HH:mm', new Date())

          // If now is after end time, skip
          if (isAfter(now, endTime)) {
            return
          }

          // Getting start time
          const startTime = max([
            now,
            addMinutes(sunset.start, sunsetMode.turnOnShift),
          ])

          this.logger.info('Setting day schedule...', {
            startTime,
            endTime,
          })

          // Scheduling on schedule
          this.turnOnSchedule = CronJob.from({
            cronTime: startTime,
            onTick: () => {
              // If in eco mode, skip
              if (this.isEcoMode) {
                return
              }
              this.setDeviceState('active')
            },
            start: true,
          })

          // Scheduling off schedule
          this.turnOffSchedule = CronJob.from({
            cronTime: endTime,
            onTick: () => {
              // Always turn off
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

  public async processQueueMessage(_msg: QueueMessage) {}

  @action.bound
  public async invokeAction(actionToInvoke: Action, res: ResDetails) {
    switch (actionToInvoke.type) {
      case SwitchBoxActionType.START:
        {
          // Setting state
          await this.setDeviceState('active')

          // Setting manual turn off schedule
          const offTime = addMinutes(new Date(), this.config.sessionDuration)

          // Getting sunset on/off schedule
          const sunsetOnTime =
            getScheduledTime(this.turnOnSchedule) || new Date()
          const sunsetOffTime =
            getScheduledTime(this.turnOffSchedule) || new Date()

          // Just in case stop previous schedule
          if (this.manualTurnOffSchedule) {
            this.manualTurnOffSchedule.stop()
          }

          // Handling edge cases
          if (isBefore(offTime, sunsetOnTime)) {
            // If off time is before sunset on time, schedule manual turn off
            this.manualTurnOffSchedule = CronJob.from({
              cronTime: offTime,
              onTick: () => {
                this.setDeviceState('idle')
              },
              start: true,
            })
          } else if (isAfter(offTime, sunsetOffTime)) {
            // If off time is after sunset off time, update turn off schedule
            this.turnOffSchedule?.setTime(new CronTime(offTime))
          }
        }
        break
      case SwitchBoxActionType.STOP:
        {
          // Setting state
          await this.setDeviceState('idle')
        }
        break
    }

    return this.viewData
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
          // Setting polling error
          this.pollingError = true
        })
      })
  }

  private async initDeviceApi() {
    // Getting api url
    const apiUrl = `http://bbx-${this.config.sn}.local/info`

    this.logger.info('Initializing API at:', apiUrl)

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

    this.logger.info('Found API at:', device.ip)

    // Setting device api
    this.deviceApi = ky.create({
      prefixUrl: `http://${device.ip}`,
    })

    // Getting relay id
    const {
      relays: [relay],
    } = await this.deviceApi
      .get<{ relays: Array<{ relay: number; state: 0 | 1 }> }>('state')
      .json()

    // Throwing error if no relays found
    if (!relay) {
      throw new Error('No relays found')
    }

    // Setting relay id
    this.relayId = relay.relay
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

  public override async toggleEcoMode(tillNextResInHrs: number) {
    this.isEcoMode = tillNextResInHrs > 12
  }
}
