import { authedClient } from '@/dao'
import type { ResDetails } from '@/models'
import { useQuery } from '@tanstack/react-query'

export const resDetailsQueryKey = ['me'] as const

/** Reservation of the current session (served from the backend cache). */
export function useResDetails() {
  return useQuery({
    queryKey: resDetailsQueryKey,
    queryFn: async (): Promise<ResDetails | null> => {
      const res = await authedClient.me.$get()
      if (!res.ok) {
        // 401 comes from the session middleware, outside the route types
        if ((res.status as number) === 401) {
          return null
        }
        throw new Error(res.statusText)
      }
      return (await res.json()) as ResDetails
    },
    staleTime: Infinity,
    retry: false,
  })
}
