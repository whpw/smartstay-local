import ContrastIcon from '@mui/icons-material/Contrast'
import { Fab, useColorScheme } from '@mui/material'
import { createBrowserRouter, RouterProvider } from 'react-router'

import useIsAuthenticated from 'react-auth-kit/hooks/useIsAuthenticated'
import { Navigate, Outlet } from 'react-router'
import { Layout } from './components/Layout'
import { HomeRoute } from './routes'
import { LoginRoute } from './routes/login'

const AuthOutlet = ({ fallbackPath }: { fallbackPath: string }) => {
  const isAuthenticated = useIsAuthenticated()
  return isAuthenticated ? <Outlet /> : <Navigate to={fallbackPath} />
}

const router = createBrowserRouter([
  {
    // path: "/login",
    element: <Layout />,
    children: [
      {
        path: '/login',
        element: <LoginRoute />,
      },
      {
        path: '/',
        element: <AuthOutlet fallbackPath="/login" />,
        children: [
          {
            path: '/',
            element: <HomeRoute />,
          },
        ],
      },
    ],
  },
])

function App() {
  const { mode, setMode } = useColorScheme()

  return (
    <>
      <RouterProvider router={router} />
      <Fab
        color="primary"
        onClick={() => setMode(mode === 'light' ? 'dark' : 'light')}
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
      >
        <ContrastIcon />
      </Fab>
    </>
  )
}

export default App
