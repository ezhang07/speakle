import './Sessions.css'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import Transcript from './Transcript'
import Metrics from './Metrics'
import Feedback from './Feedback'
import { useAuthedFetch } from './useAuthedFetch'
import type { Session, TranscriptData } from './types'


function Sessions() {
    const navigate = useNavigate();
    const authedFetch = useAuthedFetch();

    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [error, setError] = useState(false)

    const playbackRef = useRef<HTMLVideoElement>(null);

    const selected = sessions.find((s) => s.sessionId === selectedId);
    const transcriptionClickOffset = 0.2;


    function seekTime(time: number) {
        if (!playbackRef.current) {
            return;
        }
        playbackRef.current.currentTime = Math.max(0, time - transcriptionClickOffset);
        playbackRef.current.play();
    }

    useEffect(() => {
        async function loadSessions() {
            try {
                const res = await authedFetch('/api/sessions');
                const data = await res.json() as Session[];
                setSessions(data);
            } catch {
                // A 401 is already handled by authedFetch
            }
        }
        loadSessions();
    }, [authedFetch]);

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
                const text = (JSON.parse(s.transcript) as TranscriptData).text;
                const preview = s.promptText ?? text.slice(0, 60);

                return (
                <li key={s.sessionId}
                onClick={() => setSelectedId(s.sessionId)}
                className={selectedId === s.sessionId ? 'session selected' : 'session'}>
                    {date.toLocaleDateString()} {date.toLocaleTimeString()} - "{preview}..."
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

            {selected && <Transcript words={(JSON.parse(selected.transcript) as TranscriptData).words} onSeek={seekTime}></Transcript>}

            {selected && (
                <Metrics
                    wordsPerMinute={selected.wordsPerMinute}
                    fillerCount={selected.fillerCount}
                    fillersPerMinute={selected.fillersPerMinute}
                    longestPause={selected.longestPause}
                    longestPauseTimeStamp={selected.longestPauseTimeStamp}
                    bloatRatio={selected.bloatRatio}
                    timeToFirstPoint={selected.timeToFirstPoint}
                    onSeek={seekTime}
                />
            )}
            {selected && <Feedback summary={selected.summary} />}
        </div>
    )
}

export default Sessions
