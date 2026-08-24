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
  /** Plain-language definition, revealed by the tile's "?" button. */
  hint: string;
  /** Label of the tile whose panel is open, so only one shows at a time. */
  openHint: string | null;
  onOpenHint: (label: string | null) => void;
}

function StatTile({
  label,
  value,
  format,
  unit,
  average,
  seekTo,
  onSeek,
  hint,
  openHint,
  onOpenHint,
}: StatTileProps) {
  const animated = useCountUp(value)
  const seekable = seekTo !== null && seekTo !== undefined && onSeek !== undefined
  const hintOpen = openHint === label
  const panelId = `stat-hint-${label.replace(/\W+/g, '-').toLowerCase()}`

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
      <span className="stat-delta">{delta() ?? (seekable ? 'Jump to this moment' : ' ')}</span>
    </>
  )

  // The card is a plain div and the *body* is the button, because seekable tiles
  // and the "?" are two separate controls — nesting a button inside a button is
  // invalid and swallows one of the two clicks.
  return (
    <div className="stat">
      {seekable ? (
        <button
          type="button"
          className="stat-body stat-seek"
          onClick={() => onSeek(seekTo)}
          title="Jump to this moment in the video"
        >
          {body}
        </button>
      ) : (
        <div className="stat-body">{body}</div>
      )}

      <button
        type="button"
        className="stat-help"
        aria-expanded={hintOpen}
        aria-controls={panelId}
        aria-label={`What is ${label.toLowerCase()}?`}
        onClick={() => onOpenHint(hintOpen ? null : label)}
      >
        ?
      </button>

      {/* Rendered even when closed, hidden via `hidden`, so aria-controls always
          points at a real element. */}
      <p className="stat-panel" id={panelId} hidden={!hintOpen}>
        {hint}
      </p>
    </div>
  )
}

const int = (n: number) => String(Math.round(n))
const one = (n: number) => n.toFixed(1)
const two = (n: number) => n.toFixed(2)

const HINTS = {
  fillerCount:
    'How often you said “um,” “uh,” or “like.” Words that didn’t provide value and muddied your delivery.',
  wordsPerMinute:
    'Your speaking pace. See how it shifts when you’re nervous or unsure.',
  longestPause:
    'The longest silence between two words. See where you froze up, figure out why, and improve upon it. Click the tile to jump to it.',
  timeToFirstPoint:
    'How long you spoke before reaching the point you were actually making. Everything before it was warm-up. Read off your transcript by AI, so treat it as a second opinion rather than a fact. Click the tile to jump there.',
  bloatRatio:
    'Your word count divided by the words needed to say the same thing tightly. 1.0 means you were already concise; 2.0 means about twice as many words as the idea needed. The concise version is AI-written, so this is a comment on padding, not a measurement.',
}

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
  // Held here rather than per-tile so opening one panel closes any other.
  const [openHint, setOpenHint] = useState<string | null>(null)

  // Esc and a click outside dismiss the panel — the two things a native popover
  // would give for free, and the reason a bare hover tooltip isn't enough (it
  // reaches neither touch nor keyboard).
  useEffect(() => {
    if (openHint === null) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenHint(null)
    }
    function onPointerDown(e: PointerEvent) {
      if (!(e.target as HTMLElement).closest('.stat')) setOpenHint(null)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [openHint])

  const hintControls = { openHint, onOpenHint: setOpenHint }

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
          hint={HINTS.fillerCount}
          {...hintControls}
        />
        <StatTile
          label="Words / min"
          value={wordsPerMinute}
          format={int}
          average={averages?.wordsPerMinute}
          hint={HINTS.wordsPerMinute}
          {...hintControls}
        />
        <StatTile
          label="Longest pause"
          value={longestPause}
          format={one}
          unit="s"
          average={averages?.longestPause}
          seekTo={longestPauseTimeStamp}
          onSeek={onSeek}
          hint={HINTS.longestPause}
          {...hintControls}
        />
        <StatTile
          label="Time to first point"
          value={timeToFirstPoint}
          format={one}
          unit="s"
          average={averages?.timeToFirstPoint}
          seekTo={timeToFirstPoint === null ? null : timeToFirstPoint}
          onSeek={onSeek}
          hint={HINTS.timeToFirstPoint}
          {...hintControls}
        />
        <StatTile
          label="Bloat ratio"
          value={bloatRatio}
          format={two}
          average={averages?.bloatRatio}
          hint={HINTS.bloatRatio}
          {...hintControls}
        />
      </div>
    </section>
  )
}

export default Metrics
