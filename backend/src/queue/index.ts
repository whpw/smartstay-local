import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { getDeviceController } from '@/devices'
import { logger } from '@/utils/logger'

export type QueueMessage = {
  deviceId: string
  action: string
}

export type QueueMessageWrapper = {
  id: string
  message: QueueMessage
  expiresAt: number
}

function getQueueMessages() {
  return db().get<Array<QueueMessageWrapper> | undefined>('queue') || []
}

function setQueueMessages(messages: Array<QueueMessageWrapper>) {
  db().set('queue', messages)
}

function scheduleMessageProcessing(msg: QueueMessageWrapper) {
  const timeout = Math.max(msg.expiresAt - Date.now(), 0)
  setTimeout(() => {
    try {
      // Logging
      logger.info('Processing message:', msg)

      // Get message
      const message = msg.message
      const deviceController = getDeviceController(message.deviceId)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!deviceController) {
        logger.error(`Controller for device ${message.deviceId} not found`)
        return
      }
      deviceController.processQueueMessage(message)
    } catch (error) {
      logger.error('Error processing queue message:\n', msg, '\n', error)
    }

    // Remove message from the queue
    dequeueMessage(msg.id)
  }, timeout)
}

export const initQueue = () => {
  logger.info('Initializing queue...')

  // Load queue messages
  const queueMessages = getQueueMessages()

  // Process queue messages
  for (const msg of queueMessages) {
    scheduleMessageProcessing(msg)
  }
}

export const enqueueMessage = (msg: QueueMessage, ttl: number) => {
  // Logging
  logger.info('Enqueueing message:', {
    ...msg,
    expiresAt: new Date(Date.now() + ttl),
  })

  // Load queue messages
  const queueMessages = getQueueMessages()

  // Create message wrapper
  const message: QueueMessageWrapper = {
    id: randomUUID(),
    message: msg,
    expiresAt: Date.now() + ttl,
  }
  // Add new message to the queue
  queueMessages.push(message)

  // Sort queue messages by ttl ascending
  queueMessages.sort((a, b) => a.expiresAt - b.expiresAt)

  // Save queue messages
  setQueueMessages(queueMessages)

  // Schedule message processing
  scheduleMessageProcessing(message)
}

export const dequeueMessage = (id: string) => {
  // Logging
  logger.info('Dequeueing message:', id)

  // Load queue messages
  const queueMessages = getQueueMessages()

  // Remove message from the queue
  const newQueueMessages = queueMessages.filter((msg) => msg.id !== id)

  // Save queue messages
  setQueueMessages(newQueueMessages)
}
