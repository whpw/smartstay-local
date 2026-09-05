import { Skeleton, Stack } from '@mui/material'
import { BoxContainer } from './BoxContainer'

export const DeviceCardSkeleton = () => (
  <BoxContainer
    accent="#E0E0E0"
    title={<Skeleton variant="text" width={140} height={28} />}
    ctaButton={<Skeleton variant="rounded" width={120} height={48} />}
    currentTemp={<Skeleton variant="text" width={80} height={20} />}
    targetTemp={<Skeleton variant="text" width={100} height={36} />}
  />
)

export const DeviceListSkeleton = ({ count = 3 }: { count?: number }) => (
  <Stack spacing={2} sx={{ width: '100%', maxWidth: 480 }}>
    {Array.from({ length: count }, (_, i) => (
      <DeviceCardSkeleton key={i} />
    ))}
  </Stack>
)
