import { appConfig } from '@/config'
import { $DeviceType, type DeviceType } from '@/config/types'
import type { HotresReservationDTO } from '@/models/HotresDTOs'
import {
  $AddonMode,
  $ResDetails,
  type AddonDTO,
  type AddonMode,
  type ResDetails,
} from '@/models/ResDetails'
import { DAO } from '@/utils/DAO'
import { logger } from '@/utils/logger'
import { isWithinInterval, setHours } from 'date-fns'
import { adminRes } from './admin'
import { renderAddonsUrl } from './addons-url'
import { devRes } from './dev'

const isDev = () => process.env.NODE_ENV === 'development'

export const isResDetails = (res: any): res is ResDetails => {
  return $ResDetails.safeParse(res).success
}

export function normalizeLastName(lastName: string) {
  return lastName.trim().toLowerCase()
}

export async function getResDetails(
  resNumber: string,
  lastName: string,
): Promise<ResDetails> {
  // Checking if it's admin
  const isAdmin =
    resNumber === process.env.ADMIN_RES_NUMBER &&
    lastName === process.env.ADMIN_LAST_NAME

  logger.info('Getting reservation defails:', { lastName, resNumber })

  // Getting reservation from Hotres
  let res: HotresReservationDTO | never[]
  if (isAdmin) {
    res = adminRes()
  } else if (isDev()) {
    res = devRes()
  } else {
    res = await DAO.get<HotresReservationDTO>('api_reservationdetails', {
      reservations_number: resNumber,
    }).catch((err: Error) => {
      logger.error('Error getting reservation from Hotres:', err)
      return []
    })
  }

  // In edge cases Hotres returns an empty array
  if (Array.isArray(res)) {
    logger.error(
      'Error getting reservation from Hotres: Invalid response:',
      res,
    )
    throw {
      code: 'login.error',
    }
  }

  const { last_name } = res

  if (
    !last_name ||
    !lastName ||
    normalizeLastName(last_name) !== normalizeLastName(lastName)
  ) {
    logger.error('Error getting reservation from Hotres: Invalid last name:', {
      last_name,
      lastName,
    })
    throw {
      code: 'login.error',
    }
  }

  // Getting checkin and checkout dates
  const now = new Date()

  // Getting room
  const room = res.rooms.find((room) => room.room_id === appConfig.hotresRoomId)

  if (!room) {
    throw {
      code: 'login.errorNotArrivedYet',
    }
  }

  const arrDate = setHours(room.arrival_date, appConfig.checkinHour)
  const depDate = setHours(room.departure_date, appConfig.checkoutHour)

  const isNow = isWithinInterval(now, {
    start: arrDate,
    end: depDate,
  })

  if (!isNow) {
    throw {
      code: 'login.errorNotArrivedYet',
    }
  }

  // Getting all addons from reservation
  const allAddons = [
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    ...(res.addons || []),
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    ...(res.rooms || []).flatMap((room) => room.addons || []),
  ]

  // Filtering jacuzzi and sauna addons
  const addons = allAddons.reduce((acc, addon) => {
    // Getting device type and addon mode
    const title = addon.title.toLowerCase()
    // Getting device type and addon mode from title
    const [, deviceType, addonMode] =
      title.match(/\[kod: (\w+)-((\w|-)+)\]/) || []

    // Checking if device type and addon mode are valid
    if (
      deviceType &&
      addonMode &&
      $DeviceType.safeParse(deviceType).success &&
      $AddonMode.safeParse(addonMode).success
    ) {
      const existing = acc.find(
        (a) => a.type === deviceType && a.mode === addonMode,
      )
      if (existing) {
        existing.quantity += parseInt(addon.quantity)
      } else {
        acc.push({
          type: deviceType as DeviceType,
          mode: addonMode as AddonMode,
          quantity: parseInt(addon.quantity),
        })
      }
    }

    return acc
  }, [] as Array<AddonDTO>)

  // Creating JWT res object
  return {
    id: res.id,
    number: resNumber,
    arrivalDate: arrDate.toISOString(),
    departureDate: depDate.toISOString(),
    email: res.email,
    firstName: res.first_name,
    lastName: res.last_name,
    addons,
    addonsUrl: renderAddonsUrl({
      oid: appConfig.hotresObjectId ?? '',
      resId: res.id,
      resAuth: res.auth,
    }),
  }
}
