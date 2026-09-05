import { db, toKey } from '@/db'
import {
  $ComplimentaryAddon,
  type AddonDTO,
  type ComplimentaryAddon,
} from '@/models/ResDetails'

const WEEK = 60 * 60 * 24 * 7

/** Used when panel config omits `complimentaryAddons`. Pass `[]` to disable. */
export const DEFAULT_COMPLIMENTARY_ADDONS: ComplimentaryAddon[] = [
  { type: 'jacuzzi', mode: 'per-session', quantity: 1 },
]

export function normalizeComplimentaryAddons(
  value: unknown,
): ComplimentaryAddon[] {
  if (value === undefined || value === null) {
    return DEFAULT_COMPLIMENTARY_ADDONS
  }
  if (!Array.isArray(value)) {
    return DEFAULT_COMPLIMENTARY_ADDONS
  }
  return value.flatMap((item) => {
    const parsed = $ComplimentaryAddon.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

export function sameAddon(
  a: Pick<AddonDTO, 'type' | 'mode'>,
  b: Pick<AddonDTO, 'type' | 'mode'>,
) {
  return a.type === b.type && a.mode === b.mode
}

export function resolveComplimentaryAddons({
  reservationAddons,
  configured,
  previouslyGranted,
}: {
  reservationAddons: AddonDTO[]
  configured: ComplimentaryAddon[]
  previouslyGranted: ComplimentaryAddon[]
}): { addons: AddonDTO[]; grantsToPersist: ComplimentaryAddon[] } {
  const grantsToPersist = [...previouslyGranted]
  const addons: AddonDTO[] = previouslyGranted.map((grant) => ({
    ...grant,
    complimentary: true,
  }))

  for (const configuredAddon of configured) {
    if (grantsToPersist.some((grant) => sameAddon(grant, configuredAddon))) {
      continue
    }
    if (reservationAddons.some((addon) => sameAddon(addon, configuredAddon))) {
      continue
    }
    grantsToPersist.push(configuredAddon)
    addons.push({ ...configuredAddon, complimentary: true })
  }

  return { addons, grantsToPersist }
}

export function applyComplimentaryAddons(
  resNumber: string,
  departureDate: Date | string,
  reservationAddons: AddonDTO[],
  configured: ComplimentaryAddon[],
): AddonDTO[] {
  const key = toKey('complimentary-grants', resNumber)
  const previouslyGranted = db().get<ComplimentaryAddon[]>(key) ?? []
  const { addons, grantsToPersist } = resolveComplimentaryAddons({
    reservationAddons,
    configured,
    previouslyGranted,
  })

  const expireIn = new Date(departureDate).getTime() - Date.now() + WEEK
  db().set(key, grantsToPersist, Math.max(expireIn, WEEK))

  return addons
}
