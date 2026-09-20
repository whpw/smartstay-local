import { useDeviceViewData } from '@/utils/useDeviceStates'
import type { SaunaViewData } from '@backend/models'
import { DeviceCardSkeleton } from './DeviceCard'
import { SaunaBoxAuto } from './SaunaBoxAuto'
import { SaunaBoxManual } from './SaunaBoxManual'

export const SaunaBox = ({ deviceId }: { deviceId: string }) => {
  const [viewData, setViewData] = useDeviceViewData<SaunaViewData>(deviceId)

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
