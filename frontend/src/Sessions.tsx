import './Sessions.css'
import './Review.css'
import { useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import Transcript from './Transcript'
import Metrics from './Metrics'
import Feedback from './Feedback'
import { useAuthedFetch } from './useAuthedFetch'
import { computeAverages } from './averages'
import type { VideoUrlResponse, Session, TranscriptData } from './types'


function formatDuration(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return `${m}:${String(s).padStart(2, '0')}`
}

function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
        + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

/**
 * A poster frame for a session, extracted from the video by the transcription
 * job and stored alongside it in S3.
 *
 * `thumbUrl` arrives already signed on the session itself, so this costs one
 * ~20KB image and no request to our backend. Sessions recorded before
 * thumbnails existed point at a missing object — hence the error fallback.
 */
function SessionThumb({ url, durationSeconds }: { url: string; durationSeconds: number }) {
    const [ready, setReady] = useState(false)
    const [failed, setFailed] = useState(false)

    return (
        <span className="thumb">
            {!failed && (
                <img
                    className={ready ? 'thumb-img thumb-ready' : 'thumb-img'}
                    src={url}
                    alt=""
                    loading="lazy"
                    onLoad={() => setReady(true)}
                    onError={() => setFailed(true)}
                />
            )}
            {!ready && !failed && <span className="thumb-placeholder skeleton" />}
            {failed && <span className="thumb-placeholder" />}
            <span className="thumb-duration tabular">{formatDuration(durationSeconds)}</span>
        </span>
    )
}

/** Cards in their final shape while the list loads, so the page doesn't flash
 *  from empty to full. */
function SessionSkeletons() {
    return (
        <ul className="session-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => (
                <li key={i}>
                    <div className="session-card session-card-loading">
                        <span className="thumb">
                            <span className="thumb-placeholder skeleton" />
                        </span>
                        <span className="skeleton skeleton-line" style={{ width: '55%' }} />
                        <span className="skeleton skeleton-line skeleton-title" />
                        <span className="skeleton skeleton-line" style={{ width: '70%' }} />
                    </div>
                </li>
            ))}
        </ul>
    )
}

function Sessions() {
    const navigate = useNavigate();
    const authedFetch = useAuthedFetch();

    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [error, setError] = useState(false)
    const [videoURL, setVideoURL] = useState<string | null>(null);

    const playbackRef = useRef<HTMLVideoElement>(null);

    const selected = sessions.find((s) => s.sessionId === selectedId);
    const transcriptionClickOffset = 0.2;

    // Compare a session against the user's other sessions, never against an
    // absolute target.
    const averages = computeAverages(sessions, selectedId ?? undefined);


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
            } finally {
                setLoading(false);
            }
        }
        loadSessions();
    }, [authedFetch]);

    useEffect(() => {
        setError(false);
        setVideoURL(null);   // don't show the previous session's video while this one loads

        if (!selectedId) return;

        async function getVideo() {
            try {
                const res = await authedFetch(`/api/sessions/${selectedId}/video-url`);
                const data = await res.json() as VideoUrlResponse;
                setVideoURL(data.url);
            } catch {
                setError(true);
            }
        }
        getVideo();
    }, [selectedId]);

    async function deleteSession(id: string) {
        try {
            const res = await authedFetch(`/api/sessions/${id}`, { method: 'DELETE' });
            if (!res.ok) return;

            // Drop it from the list; clear the viewer if it was the open one.
            setSessions((prev) => prev.filter((s) => s.sessionId !== id));
            if (selectedId === id) {
                setSelectedId(null);
                setVideoURL(null);
            }
        } catch {
            // A 401 is already handled by authedFetch
        }
    }

    /* ------------------------------------------------- detail view ----- */

    if (selected) {
        const parsed = JSON.parse(selected.transcript) as TranscriptData;

        return (
            <div className="page rise">
                <button
                    type="button"
                    className="btn btn-ghost btn-sm back-link"
                    onClick={() => setSelectedId(null)}
                >
                    &larr; All sessions
                </button>

                <div className="review-prompt">
                    <div className="row">
                        <span className="tag">{selected.promptCategory}</span>
                        <span className="meta">{formatDate(selected.createdAt)}</span>
                    </div>
                    <h1 className="review-prompt-text">
                        {selected.promptText || parsed.text.slice(0, 90) + '…'}
                    </h1>
                </div>

                <div className="review">
                    <div className="review-media">
                        {error ? (
                            <p className="error-note">This session&rsquo;s video cannot be loaded.</p>
                        ) : (
                            <video
                                ref={playbackRef}
                                className="review-video"
                                src={videoURL ?? undefined}
                                onError={() => setError(true)}
                                controls
                            />
                        )}
                        <div className="review-media-foot">
                            <span className="meta tabular">
                                {formatDuration(selected.durationSeconds)}
                            </span>
                            <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => deleteSession(selected.sessionId)}
                            >
                                Delete session
                            </button>
                        </div>
                    </div>

                    <div className="review-body">
                        <Metrics
                            wordsPerMinute={selected.wordsPerMinute}
                            fillerCount={selected.fillerCount}
                            fillersPerMinute={selected.fillersPerMinute}
                            longestPause={selected.longestPause}
                            longestPauseTimeStamp={selected.longestPauseTimeStamp}
                            bloatRatio={selected.bloatRatio}
                            timeToFirstPoint={selected.timeToFirstPoint}
                            averages={averages}
                            onSeek={seekTime}
                        />
                        <Transcript words={parsed.words} onSeek={seekTime} />
                        <Feedback summary={selected.summary} />
                    </div>
                </div>
            </div>
        )
    }

    /* --------------------------------------------------- list view ----- */

    return (
        <div className="page">
            <div className="page-head">
                <h1>Sessions</h1>
                {!loading && sessions.length > 0 && (
                    <button type="button" className="btn btn-primary" onClick={() => navigate('/record')}>
                        New session
                    </button>
                )}
            </div>

            {loading ? (
                <SessionSkeletons />
            ) : sessions.length === 0 ? (
                <div className="empty">
                    <h2>No sessions yet</h2>
                    <p>Record one and it&rsquo;ll show up here.</p>
                    <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/record')}>
                        Record a session
                    </button>
                </div>
            ) : (
                <ul className="session-grid">
                    {sessions.map((s) => {
                        const text = (JSON.parse(s.transcript) as TranscriptData).text;
                        const title = s.promptText || text.slice(0, 70) + '…';

                        return (
                            <li key={s.sessionId}>
                                <button
                                    type="button"
                                    className="session-card"
                                    onClick={() => setSelectedId(s.sessionId)}
                                >
                                    <SessionThumb
                                        url={s.thumbUrl}
                                        durationSeconds={s.durationSeconds}
                                    />

                                    <span className="meta session-card-meta">
                                        {s.promptCategory} &middot; {formatDate(s.createdAt)}
                                    </span>

                                    <span className="session-card-title">{title}</span>

                                    <span className="session-card-stats tabular">
                                        <span><b>{s.fillerCount}</b> fillers</span>
                                        <span><b>{Math.round(s.wordsPerMinute)}</b> wpm</span>
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}

export default Sessions
