import { createTheme } from '@mui/material/styles'

const fontFamily = '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif'

const lightPalette = {
  primary: {
    main: '#1C1917',
    contrastText: '#FFFCF7',
  },
  secondary: {
    main: '#B45309',
    contrastText: '#FFFCF7',
  },
  background: {
    default: '#F3EFE8',
    paper: '#FFFCF7',
  },
  text: {
    primary: '#1C1917',
    secondary: '#78716C',
  },
  divider: 'rgba(28, 25, 23, 0.08)',
  success: {
    main: '#3F6B4F',
  },
  error: {
    main: '#B42318',
  },
}

const darkPalette = {
  primary: {
    main: '#F5F0E8',
    contrastText: '#1C1917',
  },
  secondary: {
    main: '#E8A35A',
    contrastText: '#1C1917',
  },
  background: {
    default: '#161310',
    paper: '#221E1A',
  },
  text: {
    primary: '#F5F0E8',
    secondary: '#A8A29E',
  },
  divider: 'rgba(245, 240, 232, 0.1)',
  success: {
    main: '#86A78F',
  },
  error: {
    main: '#F97066',
  },
}

export const theme = createTheme({
  cssVariables: true,
  colorSchemes: {
    light: { palette: lightPalette },
    dark: { palette: darkPalette },
  },
  palette: lightPalette,
  shape: {
    borderRadius: 14,
  },
  typography: {
    fontFamily,
    h2: {
      fontSize: '1.125rem',
      fontWeight: 600,
      letterSpacing: '-0.03em',
      lineHeight: 1.25,
    },
    h5: {
      fontWeight: 600,
      letterSpacing: '-0.03em',
    },
    h6: {
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    button: {
      fontFamily,
      fontWeight: 600,
      letterSpacing: '-0.01em',
      textTransform: 'none',
    },
    body1: {
      letterSpacing: '-0.01em',
    },
    body2: {
      letterSpacing: '-0.005em',
    },
    caption: {
      fontWeight: 500,
      letterSpacing: '0.01em',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage:
            'radial-gradient(1200px 420px at 50% -12%, rgba(180, 83, 9, 0.08), transparent 62%)',
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 14,
          minHeight: 48,
          paddingInline: 20,
          fontSize: 15,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        outlined: {
          borderColor: 'rgba(28, 25, 23, 0.14)',
        },
        sizeLarge: {
          minHeight: 52,
          fontSize: 16,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        fullWidth: true,
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 14,
          backgroundColor: theme.palette.action.hover,
          fontSize: 16,
          minHeight: 52,
        }),
        notchedOutline: {
          borderColor: 'rgba(28, 25, 23, 0.1)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        container: {
          alignItems: 'flex-end',
          '@media (min-width: 600px)': {
            alignItems: 'center',
          },
        },
        paper: {
          margin: 0,
          width: '100%',
          maxWidth: '100%',
          maxHeight: '92dvh',
          borderRadius: '28px 28px 0 0',
          '@media (min-width: 600px)': {
            margin: 32,
            maxWidth: 420,
            width: '100%',
            borderRadius: 24,
            maxHeight: '80vh',
          },
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.2rem',
          fontWeight: 600,
          letterSpacing: '-0.03em',
          paddingBottom: 8,
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: 16,
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          gap: 8,
          flexDirection: 'column-reverse',
          '& > :not(:first-of-type)': {
            marginLeft: 0,
          },
          '& .MuiButton-root': {
            width: '100%',
          },
          '@media (min-width: 600px)': {
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingBottom: 16,
            '& .MuiButton-root': {
              width: 'auto',
            },
          },
        },
      },
    },
    MuiSlider: {
      styleOverrides: {
        root: {
          padding: '18px 0',
        },
        thumb: {
          width: 28,
          height: 28,
        },
        track: {
          height: 6,
          border: 'none',
        },
        rail: {
          height: 6,
          opacity: 0.18,
        },
        mark: {
          height: 6,
          width: 2,
        },
        markLabel: {
          fontSize: 11,
          fontWeight: 600,
          top: 32,
        },
      },
    },
    MuiAccordion: {
      defaultProps: {
        disableGutters: true,
        elevation: 0,
      },
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(28, 25, 23, 0.04)',
          borderRadius: '16px !important',
          '&::before': { display: 'none' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 999,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 14,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 20,
        },
      },
    },
  },
})
