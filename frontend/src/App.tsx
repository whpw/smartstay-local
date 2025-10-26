import { SnackbarProvider } from 'notistack'
import { createBrowserRouter, RouterProvider } from 'react-router'

import { Navigate, Outlet } from 'react-router'
import { Layout } from './components/Layout'
import { HomeRoute } from './routes'
import { LoginRoute } from './routes/login'
import { useResDetails } from './utils/useResDetails'

const AuthOutlet = ({ fallbackPath }: { fallbackPath: string }) => {
  const isAuthorized = !!useResDetails()
  return isAuthorized ? <Outlet /> : <Navigate to={fallbackPath} />
}

const router = createBrowserRouter([
  {
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
  // const { mode, setMode } = useColorScheme()

  return (
    <>
      <SnackbarProvider maxSnack={3}>
        <RouterProvider router={router} />
      </SnackbarProvider>
    </>
  )
}

export default App
