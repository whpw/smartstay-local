import type { DeviceConfig } from '@/config'
import type { ResDetails } from '@/models/ResDetails'
import type { QueueMessage } from '@/queue'

export abstract class DeviceController {
  abstract get id(): string
  abstract get type(): string
  abstract init(config: DeviceConfig): Promise<void>
  abstract dispose(): void
  abstract get viewData(): DeviceViewData
  abstract processQueueMessage(msg: QueueMessage): Promise<void>
  abstract invokeAction(action: Action, res: ResDetails): Promise<unknown>
  public async toggleEcoMode(_gap: number) {
    // Doing nothing
  }
}

export interface Action {
  type: string
  value?: unknown
}

export type DeviceViewData = object
