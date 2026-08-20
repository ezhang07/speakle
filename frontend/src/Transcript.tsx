import { Fragment, useEffect, useRef, useState } from 'react'
import type { Word } from './types'
import './Transcript.css'

interface TranscriptProps {
    words: Word[];
    onSeek: (time: number) => void;
}

// NOTE: kept in sync by hand with MetricsService on the backend.
// The per-user filler-list milestone will unify these.
const fillerWords = new Set(['um', 'uh', 'like'])

function isFiller(word: string) {
    return fillerWords.has(word.toLowerCase().replace(/[^a-z]/g, ''));
}

function Transcript({ words, onSeek }: TranscriptProps) {
    // Which word was last clicked, so it can flash — the click and the video
    // jumping should feel like the same event.
    const [flashed, setFlashed] = useState<number | null>(null)
    const flashTimer = useRef<number | undefined>(undefined)

    useEffect(() => () => window.clearTimeout(flashTimer.current), [])

    function handleClick(index: number, start: number) {
        onSeek(start)
        setFlashed(index)
        window.clearTimeout(flashTimer.current)
        flashTimer.current = window.setTimeout(() => setFlashed(null), 700)
    }

    const fillerCount = words.filter((w) => isFiller(w.word)).length

    return (
        <section className="transcript">
            <div className="transcript-head">
                <h2>Transcript</h2>
                <div className="transcript-legend">
                    <span className="legend-item">
                        <span className="legend-swatch" aria-hidden="true" />
                        {fillerCount} filler{fillerCount === 1 ? '' : 's'}
                    </span>
                    <span className="legend-item muted">Click any word to jump there</span>
                </div>
            </div>

            <p className="transcript-body">
                {words.map((w, i) => (
                    <Fragment key={i}>
                        {/* Whisper emits a leading space on most words; keep it outside the
                            span so the highlight hugs the word itself. */}
                        {w.word.startsWith(' ') ? ' ' : ''}
                        <span
                            className={
                                (isFiller(w.word) ? 'filler word' : 'word') +
                                (flashed === i ? ' word-flash' : '')
                            }
                            onClick={() => handleClick(i, w.start)}
                        >
                            {w.word.trimStart()}
                        </span>
                    </Fragment>
                ))}
            </p>
        </section>
    )
}

export default Transcript
