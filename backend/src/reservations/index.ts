import { isWithinInterval, setHours } from 'date-fns'
import Mustache from 'mustache'

import type { HotresReservationDTO } from '@/models/HotresDTOs'

import { config } from '@/config'
import {
  $ResDetails,
  type AddonDTO,
  type ResDetails,
} from '@/models/ResDetails'
import { DAO } from '@/utils/DAO'
import { adminRes } from './admin'
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
  lastName: string
): Promise<ResDetails> {
  // Checking if it's admin
  const isAdmin =
    resNumber === process.env.ADMIN_RES_NUMBER &&
    lastName === process.env.ADMIN_LAST_NAME

  console.log('Getting reservation defails of:', resNumber, lastName)

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
      console.error('Error getting reservation from Hotres:', err)
      return []
    })
  }

  // In edge cases Hotres returns an empty array
  if (Array.isArray(res)) {
    console.error(
      'Error getting reservation from Hotres: Invalid response',
      res
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
    console.error('Error getting reservation from Hotres: Invalid last name', {
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
  const room = res.rooms.find((room) => room.room_id === config.roomId)

  if (!room) {
    throw {
      code: 'login.errorNotArrivedYet',
    }
  }

  const arrDate = setHours(room.arrival_date, config.checkinHour)
  const depDate = setHours(room.departure_date, config.checkoutHour)

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
    const title = addon.title.toLowerCase()
    const [, type, mode] = title.match(/\[kod: (\w+)-((\w|-)+)\]/) || []
    if (type && mode) {
      const existing = acc.find((a) => a.type === type && a.mode === mode)
      if (existing) {
        existing.quantity += parseInt(addon.quantity)
      } else {
        acc.push({
          type,
          mode: mode as AddonDTO['mode'],
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
    addonsUrl: Mustache.render(config.hotresAddonsUrl, {
      resId: res.id,
      resAuth: res.auth,
    }),
  }
}
