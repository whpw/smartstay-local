import { $DeviceType, type DeviceType } from '@/config/types'
import { $AddonMode, type AddonDTO, type AddonMode } from '@/models/ResDetails'

const ADDON_CODE = /\[kod: (\w+)-((\w|-)+)\]/

export function parseHotresAddons(
  allAddons: Array<{ title: string; quantity: string }>,
): AddonDTO[] {
  return allAddons.reduce((acc, addon) => {
    const title = addon.title.toLowerCase()
    const [, deviceType, addonMode] = title.match(ADDON_CODE) || []

    if (
      deviceType &&
      addonMode &&
      $DeviceType.safeParse(deviceType).success &&
      $AddonMode.safeParse(addonMode).success
    ) {
      const existing = acc.find(
        (a) => a.type === deviceType && a.mode === addonMode,
      )
      const quantity = parseInt(addon.quantity, 10) || 0
      if (existing) {
        existing.quantity += quantity
      } else {
        acc.push({
          type: deviceType as DeviceType,
          mode: addonMode as AddonMode,
          quantity,
        })
      }
    }

    return acc
  }, [] as Array<AddonDTO>)
}
