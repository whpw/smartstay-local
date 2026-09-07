import { appConfig } from '@/config'
import type { HotresReservationDTO } from '@/models/HotresDTOs'
import { addDays, formatISO, subDays } from 'date-fns'

// Development reservation
export const devRes = () =>
  ({
    id: '1',
    number: 12345,
    first_name: 'John',
    last_name: 'test',
    email: 'johndoe@wp.pl',
    number_str: 'dev-number-str',
    auth: 'xxx',
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
        title: 'Sauna na cały pobyt [kod: sauna-per-stay]',
        quantity: '1',
      },
    ],
  }) as unknown as HotresReservationDTO
