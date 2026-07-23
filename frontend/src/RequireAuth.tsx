import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthContext'

// Layout-route guard: renders protected route (<Outlet/>) only if token present, otherwise redirects to /login.
function RequireAuth() {
  const { token } = useAuth();

  if (token === null) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default RequireAuth
