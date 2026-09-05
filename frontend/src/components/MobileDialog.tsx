import {
  Dialog,
  type DialogProps,
  useMediaQuery,
  useTheme,
} from '@mui/material'

export const MobileDialog = ({
  children,
  slotProps,
  ...props
}: DialogProps) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const paperSlot = slotProps?.paper
  const paperSx =
    paperSlot && typeof paperSlot === 'object' && 'sx' in paperSlot
      ? (paperSlot.sx as object | undefined)
      : undefined

  return (
    <Dialog
      fullScreen={isMobile}
      fullWidth
      maxWidth="sm"
      {...props}
      slotProps={{
        ...slotProps,
        paper: {
          ...(typeof paperSlot === 'object' ? paperSlot : {}),
          sx: {
            ...(isMobile ? { borderRadius: 0 } : { borderRadius: 3 }),
            ...paperSx,
          },
        },
      }}
    >
      {children}
    </Dialog>
  )
}
