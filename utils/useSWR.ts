import { IS_BROWSER } from '$fresh/runtime.ts'
import { useCallback, useEffect, useState } from 'preact/hooks'

export function useSWR<T>(
    key: string,
    fetcher: (url: string) => Promise<T>,
    options?: { interval?: number },
) {
    const [response, setData] = useState<{
        data?: T
        error?: Error
    }>({})

    const mutate = useCallback(() => {
        fetcher(key).then((data) => setData({ data })).catch((error) =>
            setData({ error })
        )
    }, [key, fetcher])

    useEffect(() => {
        if (IS_BROWSER) {
            // Fetch data on mount
            mutate()

            if (options?.interval) {
                const interval = setInterval(() => {
                    mutate()
                }, options.interval)
                return () => clearInterval(interval)
            }
        }
    }, [key, fetcher, options?.interval])
    return {
        data: response.data,
        error: response.error,
        mutate,
    }
}
