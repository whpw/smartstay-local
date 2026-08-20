export type FailedHotresRequestDTO = {
  result: 'error' | undefined
  message: string
}

export interface HotresRoomAddonDTO {
  attributes_id: string
  quantity: string
  mode: string
  title: string
  price: string
  amount: string
}

export interface HotresAddonDTO {
  addon_id: string
  room_id: string
  title: string
  quantity: string
  price: string
  amount: string
  tax: string
  included: boolean
  add_date: string
}

export interface HotresPaymentDTO {
  id: string
  amount: string
  type: string
  transaction: string
  paid: boolean
  payment_date: string
  payment_type: string
  add_date: string
  comment: string | null
}

export interface HotresReservationDTO {
  id: string
  number: string
  /** Public extras-page token; previously `auth`. */
  number_str: string
  auth?: string
  add_date: string
  mod_date: string
  payment_date: string | null
  cancel_date: string | null
  last_change: string
  source: string
  source_number: string
  rate_id: string
  rate_title: string
  rate_board: string
  status: string
  lang: string
  amount: string
  addons_amount: string
  total: number
  currency: string
  deposit: number
  paid: string
  discount: string | null
  before_discount: string
  arrival_date: string
  departure_date: string
  arrival_hour: string
  departure_hour: string
  first_name: string
  last_name: string
  email: string
  phone: string
  phone_prefix: string
  address: string
  city: string
  zip: string
  country_id: string
  invoice: boolean
  company_name: string
  company_nip: string
  company_address: string
  company_city: string
  company_zip: string
  company_country: string
  checkin_online: string
  checkin_online_date: string | null
  message: string | null
  rooms: Array<HotresRoomDTO>
  addons: Array<HotresAddonDTO>
  payments: Array<HotresPaymentDTO>
}

export interface HotresRoomDTO {
  type_id: string
  room_id: string
  internal_id: string
  code: string
  title: string
  key_code: string
  arrival_date: string
  departure_date: string
  amount: string
  before_discount: string
  guest_name: string
  rooms_price: string
  adults: number
  child1: number
  child2: number
  child3: number
  checkin_date: string | null
  checkout_date: string | null
  first_name: string
  last_name: string
  email: string
  phone: string
  phone_prefix: string
  address: string
  zip: string
  city: string
  addons: Array<HotresRoomAddonDTO>
}
