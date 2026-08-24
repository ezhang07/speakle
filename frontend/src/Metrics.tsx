import { useEffect, useState } from 'react'
import './Metrics.css'
import type { MetricAverages } from './types'

interface MetricsProps {
  wordsPerMinute: number;
  fillerCount: number;
  longestPause: number;
  longestPauseTimeStamp: number;
  bloatRatio: number | null;
  timeToFirstPoint: number | null;
  /** The user's own history, if there's enough of it. Drives the "vs your
   *  average" line — the thing that turns a scoreboard into a coach. */
  averages?: MetricAverages | null;
  onSeek: (time: number) => void;
}

/** Counts a number up from zero on mount so the reveal feels like a result
 *  landing rather than a page painting. Honours reduced-motion. */
function useCountUp(target: number | null, duration = 650): number | null {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (target === null) return
    const to = target

    // Reduced motion lands on the final value on the first frame rather than
    // skipping the effect, so every update stays inside the rAF callback and
    // never fires synchronously in the effect body.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let frame = 0
    const start = performance.now()

    function step(now: number) {
      const t = reduced ? 1 : Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)   // ease-out cubic
      setValue(to * eased)
      if (t < 1) frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])

  return target === null ? null : value
}

interface StatTileProps {
  label: string;
  value: number | null;
  format: (n: number) => string;
  unit?: string;
  average?: number | null;
  /** When set, the tile becomes a button that seeks the video to this moment. */
  seekTo?: number | null;
  onSeek?: (time: number) => void;
}

function StatTile({ label, value, format, unit, average, seekTo, onSeek }: StatTileProps) {
  const animated = useCountUp(value)
  const seekable = seekTo !== null && seekTo !== undefined && onSeek !== undefined

  // Deliberately no good/bad colouring — the number is neutral, the comparison
  // to your own past is what makes it mean something.
  function delta() {
    if (value === null || average === null || average === undefined) return null
    const diff = value - average
    const shown = format(Math.abs(diff))
    if (shown === format(0)) return 'on par with your average'
    return `${diff < 0 ? '↓' : '↑'} ${shown} vs your average`
  }

  const body = (
    <>
      <span className="stat-value tabular">
        {animated === null ? '—' : format(animated)}
        {unit && animated !== null && <span className="stat-unit">{unit}</span>}
      </span>
      <span className="stat-label">{label}</span>
      <span className="stat-delta">{delta() ?? (seekable ? 'Jump to this moment' : ' ')}</span>
    </>
  )

  if (seekable) {
    return (
      <button
        type="button"
        className="stat stat-seek"
        onClick={() => onSeek(seekTo)}
        title="Jump to this moment in the video"
      >
        {body}
      </button>
    )
  }

  return <div className="stat">{body}</div>
}

const int = (n: number) => String(Math.round(n))
const one = (n: number) => n.toFixed(1)
const two = (n: number) => n.toFixed(2)

function Metrics({
  wordsPerMinute,
  fillerCount,
  longestPause,
  longestPauseTimeStamp,
  bloatRatio,
  timeToFirstPoint,
  averages,
  onSeek,
}: MetricsProps) {
  return (
    <section className="metrics">
      <div className="metrics-head">
        <h2>Metrics</h2>
        {averages && (
          <span className="muted metrics-basis">
            compared with your last {averages.count} sessions
          </span>
        )}
      </div>

      <div className="stat-grid">
        <StatTile
          label="Filler words"
          value={fillerCount}
          format={int}
          average={averages?.fillerCount}
        />
        <StatTile
          label="Words / min"
          value={wordsPerMinute}
          format={int}
          average={averages?.wordsPerMinute}
        />
        <StatTile
          label="Longest pause"
          value={longestPause}
          format={one}
          unit="s"
          average={averages?.longestPause}
          seekTo={longestPauseTimeStamp}
          onSeek={onSeek}
        />
        <StatTile
          label="Time to first point"
          value={timeToFirstPoint}
          format={one}
          unit="s"
          average={averages?.timeToFirstPoint}
          seekTo={timeToFirstPoint === null ? null : timeToFirstPoint}
          onSeek={onSeek}
        />
        <StatTile
          label="Bloat ratio"
          value={bloatRatio}
          format={two}
          average={averages?.bloatRatio}
        />
      </div>

      {/* Collapsed by default: the numbers are the point, the definitions are
          for the first few sessions and for the two metrics nobody can guess. */}
      <details className="metrics-glossary">
        <summary>What these mean</summary>

        <dl>
          <div>
            <dt>Filler words</dt>
            <dd>How often you said “um,” “uh,” or “like.” Words that didn't provide value and muddied your delivery.</dd>
          </div>
          <div>
            <dt>Words / min</dt>
            <dd>
              Your speaking pace. Neither fast nor slow is better — it’s here so
              you can watch how it shifts when you’re nervous or unsure.
            </dd>
          </div>
          <div>
            <dt>Longest pause</dt>
            <dd>
              The longest silence between two words. The gap before your very
              first word counts too, so a slow start shows up here. Click the
              tile to jump to it.
            </dd>
          </div>
          <div>
            <dt>Time to first point</dt>
            <dd>
              How long you spoke before reaching the point you were actually
              making — everything before it was warm-up. Click the tile to jump
              there and hear it.
            </dd>
          </div>
          <div>
            <dt>Bloat ratio</dt>
            <dd>
              Your word count divided by the words needed to say the same thing
              tightly. 1.0 means you were already tight; 2.0 means about twice
              as many words as the idea needed.
            </dd>
          </div>
        </dl>

        <p className="metrics-glossary-note">
          Time to first point and bloat ratio are read off your transcript by AI
          rather than measured, so treat them as a second opinion rather than a
          fact. If that step fails they show as —.
        </p>
      </details>
    </section>
  )
}

export default Metrics
