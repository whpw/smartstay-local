import { $DeviceType } from '@/config/types'
import z from 'zod'

export const $AddonMode = z.enum([
  // One payment for each session, quantity defines number of sessions during whole stay
  'per-session',
  // One payment for each day, unlimited sessions per day, quantity defines number of days with unlimited sessions
  'per-day',
  // One payment for whole stay, unlimited sessions per day, quantity doesn't matter
  'per-stay',
])

export const $AddonDTO = z.object({
  type: $DeviceType,
  mode: $AddonMode,
  quantity: z.number(),
})

export const $ResDetails = z.object({
  id: z.string(),
  number: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  arrivalDate: z.string(),
  departureDate: z.string(),
  addons: z.array($AddonDTO),
  addonsUrl: z.string(),
})

export type AddonDTO = z.infer<typeof $AddonDTO>
export type ResDetails = z.infer<typeof $ResDetails>
export type AddonMode = z.infer<typeof $AddonMode>
