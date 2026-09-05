import { createTheme } from '@mui/material'

const touchTarget = 48

export const deviceColors = {
  sauna: '#E8714A',
  jacuzzi: '#3B9FD9',
  heating: '#E85D5D',
  light: '#F5B942',
} as const

export const theme = createTheme({
  colorSchemes: {
    dark: true,
  },
  palette: {
    primary: {
      main: '#1A1A1A',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#6B7280',
    },
    background: {
      default: '#F4F2EF',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A1A1A',
      secondary: '#6B7280',
    },
    divider: 'rgba(0, 0, 0, 0.08)',
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h5: {
      fontWeight: 600,
      fontSize: '1.375rem',
      letterSpacing: '-0.01em',
    },
    h6: {
      fontWeight: 600,
      fontSize: '1.125rem',
      letterSpacing: '-0.01em',
    },
    subtitle1: {
      fontWeight: 500,
      fontSize: '1rem',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '0.9375rem',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
          minHeight: touchTarget,
          padding: '10px 20px',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        sizeLarge: {
          minHeight: 52,
          fontSize: '1rem',
          padding: '12px 24px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          padding: '16px 0',
        },
        thumb: {
          width: 24,
          height: 24,
          '&:hover, &.Mui-focusVisible': {
            boxShadow: '0 0 0 8px rgba(26, 26, 26, 0.08)',
          },
        },
        markLabel: {
          fontSize: '0.75rem',
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            minHeight: touchTarget,
          },
        },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '&:before': {
            display: 'none',
          },
          '&.Mui-expanded': {
            margin: 0,
          },
        },
      },
    },
  },
})
