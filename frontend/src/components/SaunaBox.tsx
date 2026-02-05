import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { authedClient } from '@/dao'
import type { SaunaViewData } from '@backend/models'
import { useMutation } from '@tanstack/react-query'
import { SaunaBoxAuto } from './SaunaBoxAuto'
import { SaunaBoxManual } from './SaunaBoxManual'

export const SaunaBox = ({ deviceId }: { deviceId: string }) => {
  // Data state
  const [viewData, setViewData] = useState<SaunaViewData>()

  const { t } = useTranslation()

  const [upsellingModalOpen, setUpsellingModalOpen] = useState(false)

  const { mutate: startSession } = useMutation({
    mutationFn: async () => {
      return authedClient.action
        .$post({
          json: {
            deviceId,
            action: {
              type: 'START',
            },
          },
        })
        .then((res) => res.json())
    },
    onSuccess: (data) => {
      if ('error' in data && data.error === 'REACHED_LIMIT') {
        setUpsellingModalOpen(true)
        return
      }
      // Setting da
      setViewData(data as SaunaViewData)
    },
  })

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

  if (!viewData) return <div>Loading...</div>

  if (viewData.thermostat === 'saunabox') {
    return (
      <SaunaBoxAuto
        viewData={viewData}
        setViewData={setViewData}
        deviceId={deviceId}
      />
    )
  } else {
    return (
      <SaunaBoxManual
        viewData={viewData}
        setViewData={setViewData}
        deviceId={deviceId}
      />
    )
  }
}
