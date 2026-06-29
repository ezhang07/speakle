import './Sessions.css'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

function Sessions() {
    const navigate = useNavigate();

    const [sessions, setSessions] = useState([]);

    useEffect(() => {
        async function loadSessions() {
            const res = await fetch('/api/sessions');

            const data = await res.json();
            setSessions(data);
        }
        loadSessions();
    }, []); 

    return (
        <div className="sessions">
            <h1>Sessions</h1>
            <button type="button" onClick={() => {navigate('/')}}>
                Return back home
            </button>
            <ul>
            {sessions.map((s) => (
                <li key={s.sessionId}>
                    {s.createdAt} - {s.transcript.slice(0, 60)}...
                </li>
            ))}
            </ul>
        </div>
    )
}

export default Sessions