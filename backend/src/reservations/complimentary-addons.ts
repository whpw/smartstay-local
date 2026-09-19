import { db, toKey } from '@/db'
import type { DeviceType } from '@/config/types'
import {
  $ComplimentaryAddon,
  type AddonDTO,
  type AddonMode,
  type ComplimentaryAddon,
} from '@/models/ResDetails'

const WEEK = 60 * 60 * 24 * 7

export function normalizeComplimentaryAddons(
  value: unknown,
): ComplimentaryAddon[] {
  if (!Array.isArray(value)) {
    return []
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

function paidAddonQuantity(
  reservationAddons: AddonDTO[],
  deviceType: DeviceType,
  addonMode: AddonMode,
) {
  return reservationAddons
    .filter((addon) => sameAddon(addon, { type: deviceType, mode: addonMode }))
    .reduce((sum, addon) => sum + addon.quantity, 0)
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
  const addons: AddonDTO[] = []

  for (const configuredAddon of configured) {
    const existingGrant = grantsToPersist.find((grant) =>
      sameAddon(grant, configuredAddon),
    )
    if (existingGrant) {
      addons.push({ ...existingGrant, complimentary: true })
      continue
    }
    if (
      paidAddonQuantity(
        reservationAddons,
        configuredAddon.type,
        configuredAddon.mode,
      ) > 0
    ) {
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
