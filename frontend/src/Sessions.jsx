import './Sessions.css'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'


function Sessions() {
    const navigate = useNavigate();

    const [sessions, setSessions] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [error, setError] = useState(false)
    
    const playbackRef = useRef(null);

    const selected = sessions.find((s) => s.sessionId === selectedId);

    useEffect(() => {
        async function loadSessions() {
            const res = await fetch('/api/sessions');

            const data = await res.json();
            setSessions(data);
        }
        loadSessions();
    }, []); 

    useEffect(() => {
        setError(false);
    }, [selectedId]);

    return (
        <div className="sessions">
            <h1>Sessions</h1>
            <button type="button" onClick={() => {navigate('/')}}>
                Return back home
            </button>
            <ul>
            {sessions.map((s) => {
                const date = new Date(s.createdAt);
                const text = JSON.parse(s.transcript).text;
            
                return (
                <li key={s.sessionId} 
                onClick={() => setSelectedId(s.sessionId)} 
                className={selectedId === s.sessionId ? 'session selected' : 'session'}>
                    {date.toLocaleDateString()} {date.toLocaleTimeString()} - "{text.slice(0, 60)}..."
                </li>
            )})}
            </ul>

            {selected && (
                <div className="playback">
                    {error ? <p>
                        This session's video cannot be loaded.
                    </p> :
                    <video ref={playbackRef} 
                    src={`/api/sessions/${selected.sessionId}/video`} 
                    onError={() => setError(true)} controls>
                    </video>}
                    </div>
            )}
        </div>
    )
}

export default Sessions