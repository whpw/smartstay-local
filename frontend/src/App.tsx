import { SnackbarProvider } from 'notistack'
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  RouterProvider,
} from 'react-router'

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
  return (
    <SnackbarProvider
      maxSnack={3}
      autoHideDuration={3500}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <RouterProvider router={router} />
    </SnackbarProvider>
  )
}

export default App
