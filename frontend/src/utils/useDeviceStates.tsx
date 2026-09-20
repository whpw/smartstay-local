import type { DeviceStateUpdate, DeviceViewData } from '@backend/models'
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

const DeviceStateContext = createContext<Record<string, DeviceViewData>>({})

export function DeviceStateProvider({ children }: { children: ReactNode }) {
  const [states, setStates] = useState<Record<string, DeviceViewData>>({})

  useEffect(() => {
    const evtSource = new EventSource('/api/state', {
      withCredentials: true,
    })

    evtSource.addEventListener('device-state-update', (event) => {
      const { deviceId, viewData } = JSON.parse(event.data) as DeviceStateUpdate
      setStates((prev) => ({ ...prev, [deviceId]: viewData }))
    })

    return () => {
      evtSource.close()
    }
  }, [])

  return (
    <DeviceStateContext.Provider value={states}>
      {children}
    </DeviceStateContext.Provider>
  )
}

export function useDeviceViewData<T extends DeviceViewData>(deviceId: string) {
  const fromStream = useContext(DeviceStateContext)[deviceId] as T | undefined
  const [local, setLocal] = useState<T | undefined>(fromStream)

  useEffect(() => {
    if (fromStream !== undefined) {
      setLocal(fromStream)
    }
  }, [fromStream])

  return [local, setLocal] as const
}
