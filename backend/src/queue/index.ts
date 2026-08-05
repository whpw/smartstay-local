import { randomUUID } from 'node:crypto'

import { db } from '@/db'
import { getDeviceController } from '@/devices'
import { logger } from '@/utils/logger'

export type QueueMessage = {
  deviceId: string
  action: string
  /** When set, stop handlers ignore the message if the current session endTime differs. */
  sessionEndTime?: number
}

export type QueueMessageWrapper = {
  id: string
  message: QueueMessage
  expiresAt: number
}

const DEVICE_NOT_READY_DELAY_MS = 5_000
const PROCESSING_ERROR_DELAY_MS = 30_000

const scheduledTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function getQueueMessages() {
  return db().get<Array<QueueMessageWrapper> | undefined>('queue') || []
}

function setQueueMessages(messages: Array<QueueMessageWrapper>) {
  db().set('queue', messages)
}

function clearScheduledTimeout(id: string) {
  const timeout = scheduledTimeouts.get(id)
  if (timeout) {
    clearTimeout(timeout)
    scheduledTimeouts.delete(id)
  }
}

function isDeviceNotFoundError(error: unknown) {
  return error instanceof Error && /Device \[.*\] not found/.test(error.message)
}

function rescheduleMessage(id: string, delayMs: number) {
  const queueMessages = getQueueMessages()
  const index = queueMessages.findIndex((msg) => msg.id === id)
  if (index === -1) {
    return
  }

  const updated: QueueMessageWrapper = {
    ...queueMessages[index],
    expiresAt: Date.now() + delayMs,
  }
  queueMessages[index] = updated
  queueMessages.sort((a, b) => a.expiresAt - b.expiresAt)
  setQueueMessages(queueMessages)

  logger.info('Rescheduling message:', {
    id,
    delayMs,
    expiresAt: new Date(updated.expiresAt),
  })

  scheduleMessageProcessing(updated)
}

async function processMessage(msg: QueueMessageWrapper) {
  try {
    logger.info('Processing message:', msg)

    const deviceController = getDeviceController(msg.message.deviceId)
    await deviceController.processQueueMessage(msg.message)
    dequeueMessage(msg.id)
  } catch (error) {
    logger.error('Error processing queue message:\n', msg, '\n', error)

    // Keep the message and retry — do not dequeue on failure
    const delayMs = isDeviceNotFoundError(error)
      ? DEVICE_NOT_READY_DELAY_MS
      : PROCESSING_ERROR_DELAY_MS
    rescheduleMessage(msg.id, delayMs)
  }
}

function scheduleMessageProcessing(msg: QueueMessageWrapper) {
  clearScheduledTimeout(msg.id)

  const timeout = Math.max(msg.expiresAt - Date.now(), 0)
  const handle = setTimeout(() => {
    scheduledTimeouts.delete(msg.id)
    void processMessage(msg)
  }, timeout)
  scheduledTimeouts.set(msg.id, handle)
}

export const initQueue = () => {
  logger.info('Initializing queue...')

  const queueMessages = getQueueMessages()

  for (const msg of queueMessages) {
    scheduleMessageProcessing(msg)
  }
}

export const enqueueMessage = (msg: QueueMessage, ttl: number) => {
  logger.info('Enqueueing message:', {
    ...msg,
    expiresAt: new Date(Date.now() + ttl),
  })

  const queueMessages = getQueueMessages()

  const message: QueueMessageWrapper = {
    id: randomUUID(),
    message: msg,
    expiresAt: Date.now() + ttl,
  }
  queueMessages.push(message)
  queueMessages.sort((a, b) => a.expiresAt - b.expiresAt)

  setQueueMessages(queueMessages)
  scheduleMessageProcessing(message)
}

export const dequeueMessage = (id: string) => {
  logger.info('Dequeueing message:', id)

  clearScheduledTimeout(id)

  const queueMessages = getQueueMessages()
  const newQueueMessages = queueMessages.filter((msg) => msg.id !== id)
  setQueueMessages(newQueueMessages)
}

export const hasPendingMessage = (deviceId: string, action: string) => {
  return getQueueMessages().some(
    (msg) => msg.message.deviceId === deviceId && msg.message.action === action,
  )
}

export const cancelPendingMessages = (deviceId: string, action: string) => {
  const queueMessages = getQueueMessages()
  const remaining: Array<QueueMessageWrapper> = []

  for (const msg of queueMessages) {
    if (msg.message.deviceId === deviceId && msg.message.action === action) {
      clearScheduledTimeout(msg.id)
      logger.info('Cancelling pending message:', msg.id, msg.message)
    } else {
      remaining.push(msg)
    }
  }

  setQueueMessages(remaining)
}

export const disposeQueue = () => {
  for (const id of scheduledTimeouts.keys()) {
    clearScheduledTimeout(id)
  }
}
