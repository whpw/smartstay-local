import type { Action } from '@/models/ViewData'
import { getDeviceController } from './index'

import type { AuthedEnv } from '@/routes/authed'
import { getContext } from 'hono/context-storage'

export const actionHandler = async (data: {
  deviceId: string
  action: Action
}) => {
  const { deviceId, action } = data

  try {
    // Get controller
    const device = getDeviceController(deviceId)

    // Get reservation details
    const resDetails = getContext<AuthedEnv>().get('resDetails')

    if (!resDetails) {
      throw new Error('Reservation not found')
    }

    console.log('Invoking action:', action)

    // Invoke action
    const result = await device.invokeAction(action, resDetails)

    console.log('Action result:', result)

    return result as {}
  } catch (error) {
    console.error('Error invoking action:', error)
    return {
      error: 'UNKNOWN_ERROR',
    }
  }
}
