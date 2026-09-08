import { useEffect, useState } from 'react'

import type { SaunaViewData } from '@backend/models'
import { DeviceCardSkeleton } from './DeviceCard'
import { SaunaBoxAuto } from './SaunaBoxAuto'
import { SaunaBoxManual } from './SaunaBoxManual'

export const SaunaBox = ({ deviceId }: { deviceId: string }) => {
  const [viewData, setViewData] = useState<SaunaViewData>()

  useEffect(() => {
    const evtSource = new EventSource(`/api/state/${deviceId}`, {
      withCredentials: true,
    })

    evtSource.addEventListener('device-state-update', (event) => {
      const receivedData = JSON.parse(event.data)
      console.log('Received sauna state update:', receivedData)
      setViewData(receivedData as SaunaViewData)
    })

    return () => {
      evtSource.close()
    }
  }, [deviceId])

  if (!viewData) return <DeviceCardSkeleton />

  if (viewData.thermostat === 'saunabox') {
    return (
      <SaunaBoxAuto
        viewData={viewData}
        setViewData={setViewData}
        deviceId={deviceId}
      />
    )
  }

  return (
    <SaunaBoxManual
      viewData={viewData}
      setViewData={setViewData}
      deviceId={deviceId}
    />
  )
}
