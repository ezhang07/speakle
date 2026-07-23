import './App.css'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

function Home() {
    const navigate = useNavigate();
    const { token, logout } = useAuth();

  return (
    <div className="home">
      <h1>Speakle</h1>
        <p>Record yourself speaking and figure out where you stumble.</p>

        {token ? (
          <>
            <button type="button" onClick={() => navigate('/record')}>
            Start Recording
            </button>


            <button type="button" onClick={() => navigate('/sessions')}>
            View Past Sessions
            </button>

            <button type="button" onClick={logout}>
            Log out
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => navigate('/login')}>
            Log in
            </button>

            <button type="button" onClick={() => navigate('/register')}>
            Register
            </button>
          </>
        )}
    </div>
  )
}

export default Home
