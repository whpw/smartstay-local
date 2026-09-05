import { TZDate } from '@date-fns/tz'
import { lightFormat } from 'date-fns'

export function formatRemaining(durationMs: number) {
  return lightFormat(new TZDate(durationMs, 'UTC'), 'HH:mm')
}
