import { appConfig } from '@/config'
import type { HotresReservationDTO } from '@/models/HotresDTOs'
import { addDays, formatISO, subDays } from 'date-fns'

// Admin reservation
export const adminRes = () =>
  ({
    id: '1',
    number: process.env.ADMIN_RES_NUMBER,
    first_name: process.env.ADMIN_LAST_NAME,
    last_name: process.env.ADMIN_LAST_NAME,
    email: '',
    auth: '',
    rooms: [
      {
        room_id: appConfig.hotresRoomId,
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
        title: 'Jacuzzi na cały pobyt [kod: jacuzzi-per-stay]',
        quantity: '1',
      },
      {
        title: 'Sauna na cały pobyt [kod: sauna-per-stay]',
        quantity: '1',
      },
    ],
  } as unknown as HotresReservationDTO)
