import {
  addDays,
  formatISO,
  isWithinInterval,
  setHours,
  subDays,
} from 'date-fns'
import Mustache from 'mustache'

import type { HotresReservationDTO } from '@/utils/DTOs'

import { config } from '@/config'
import { DAO } from '@/utils/DAO'
import { $ResDetails, type AddonDTO, type ResDetails } from './ResDetails'

// export const tpl = new Template()

// export const tz = { timeZone: Deno.env.get('TZ') as string }

const isDev = process.env.NODE_ENV === 'development'

export const isResDetails = (res: any): res is ResDetails => {
  return $ResDetails.safeParse(res).success
}

export function normalizeLastName(lastName: string) {
  return lastName.trim().toLowerCase()
}

// Development reservation
const devRes = () => ({
  id: '1',
  number: 12345,
  first_name: 'John',
  last_name: 'test',
  email: 'johndoe@wp.pl',
  auth: 'xxx',
  rooms: [
    {
      room_id: config.roomId,
      arrival_date: formatISO(subDays(new Date(), 1), {
        representation: 'date',
      }),
      departure_date: formatISO(addDays(new Date(), 1), {
        representation: 'date',
      }),
      addons: [],
    },
  ],
  addons: [
    {
      title: 'jedna sesja jacuzzi [kod: jacuzzi-per-session]',
      quantity: '100',
    },
    {
      title: 'Sauna na cały pobyt [kod: sauna-per-stay]',
      quantity: '1',
    },
  ],
})

export async function getResDetails(
  resNumber: string,
  lastName: string
): Promise<ResDetails> {
  // Getting reservation from Hotres
  const res = isDev
    ? devRes()
    : await DAO.get<HotresReservationDTO>('/api_reservationdetails', {
        reservations_number: resNumber,
      }).catch((err: Error) => {
        console.error('Error getting reservation from Hotres:', err)
        return []
      })

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
