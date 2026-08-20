import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import './Layout.css'

/** The persistent app frame: a slim top bar over the routed page.
 *  Record's prep/recording phases deliberately cover this with a full-screen
 *  overlay — during a take, nothing should compete with the camera. */
function Layout() {
  const { token, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="wordmark">
            <span className="wordmark-mark" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            Speakle
          </Link>

          <nav className="topnav">
            {token ? (
              <>
                <NavLink to="/record" className="navlink">
                  Record
                </NavLink>
                <NavLink to="/sessions" className="navlink">
                  Sessions
                </NavLink>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={handleLogout}
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className="navlink">
                  Log in
                </NavLink>
                <Link to="/register" className="btn btn-primary btn-sm">
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}

export default Layout
