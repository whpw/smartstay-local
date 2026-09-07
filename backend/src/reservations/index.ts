import { appConfig } from '@/config'
import type { HotresReservationDTO } from '@/models/HotresDTOs'
import { $ResDetails, type ResDetails } from '@/models/ResDetails'
import { DAO } from '@/utils/DAO'
import { logger } from '@/utils/logger'
import { isNowInStay, stayWindow } from '@/utils/stay-window'
import { adminRes } from './admin'
import { renderAddonsUrl } from './addons-url'
import {
  applyComplimentaryAddons,
  normalizeComplimentaryAddons,
} from './complimentary-addons'
import { devRes } from './dev'
import { parseHotresAddons } from './parse-addons'

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

  // Getting room
  const room = res.rooms.find((room) => room.room_id === appConfig.hotresRoomId)

  if (!room) {
    throw {
      code: 'login.errorNotArrivedYet',
    }
  }

  const window = stayWindow(
    room.arrival_date,
    room.departure_date,
    appConfig.checkinHour,
    appConfig.checkoutHour,
    appConfig.tz,
  )

  if (!window || !isNowInStay(window)) {
    throw {
      code: 'login.errorNotArrivedYet',
    }
  }

  const { start: arrDate, end: depDate } = window

  // Getting all addons from reservation
  const allAddons = [
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    ...(res.addons || []),
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    ...(res.rooms || []).flatMap((room) => room.addons || []),
  ]

  const reservationAddons = parseHotresAddons(allAddons)
  const complimentaryAddons = applyComplimentaryAddons(
    resNumber,
    depDate,
    reservationAddons,
    normalizeComplimentaryAddons(appConfig.complimentaryAddons),
  )
  // Complimentary first so session counters consume free entitlement before paid
  const addons = [...complimentaryAddons, ...reservationAddons]

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
    addonsUrl: renderAddonsUrl(appConfig.hotresAddonsUrl, {
      oid: appConfig.hotresObjectId ?? '',
      resId: res.id,
      number_str: res.number_str,
      resAuth: res.auth,
    }),
  }
}
