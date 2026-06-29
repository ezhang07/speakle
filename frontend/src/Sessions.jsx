import './Sessions.css'
import { useNavigate } from 'react-router-dom'

function Sessions() {
    const navigate = useNavigate();

    return (
        <div className="sessions">
            <h1>Sessions</h1>
            <button type="button" onClick={() => {navigate('/')}}>
                Return back home
            </button>
        </div>
    )
}

export default Sessions