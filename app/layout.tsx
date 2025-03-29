import { auth } from '@/auth.ts'
import theme from '@/theme.ts'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import type { Navigation } from '@toolpad/core/AppProvider'
import { NextAppProvider } from '@toolpad/core/nextjs'
import { SessionProvider, signIn, signOut } from 'next-auth/react'

const NAVIGATION: Navigation = [
  {
    kind: 'header',
    title: 'Main items',
  },
  {
    segment: '',
    title: 'Dashboard',
    icon: <DashboardIcon />,
  },
  {
    segment: 'orders',
    title: 'Orders',
    icon: <ShoppingCartIcon />,
  },
]

const BRANDING = {
  title: 'My Toolpad Core Next.js App',
}

const AUTHENTICATION = {
  signIn,
  signOut,
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const session = await auth()

  return (
    <html lang='en' data-toolpad-color-scheme='light' suppressHydrationWarning>
      <body>
        <SessionProvider session={session}>
          <AppRouterCacheProvider options={{ enableCssLayer: true }}>
            <NextAppProvider
              navigation={NAVIGATION}
              branding={BRANDING}
              session={session}
              authentication={AUTHENTICATION}
              theme={theme}
            >
              {props.children}
            </NextAppProvider>
          </AppRouterCacheProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
