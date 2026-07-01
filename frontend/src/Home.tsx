import './App.css'
import { useNavigate } from 'react-router-dom'

function Home() {
    const navigate = useNavigate();

  return (
    <div className="home">
      <h1>Speakle</h1>
        <p>Record yourself speaking and figure out where you stumble.</p>
        <button type="button" onClick={() => navigate('/record')}>
        Start Recording
        </button>


        <button type="button" onClick={() => navigate('/sessions')}>
        View Past Sessions
        </button>
    </div>
  )
}

export default Home
