import type { Session, MetricAverages } from './types'

/** Below this many past sessions, "your average" isn't meaningful enough to show. */
const MIN_SESSIONS_FOR_AVERAGE = 2

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

/** Average of the values that aren't null; null if there are none.
 *  bloatRatio / timeToFirstPoint come from the LLM and are non-fatal, so a
 *  session can legitimately be missing them. */
function nullableMean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null)
  return present.length ? mean(present) : null
}

/**
 * Average each metric across `sessions`, skipping `excludeId` (the session
 * currently being viewed — you shouldn't be compared against yourself).
 * Returns null when there isn't enough history to draw a comparison from.
 */
export function computeAverages(
  sessions: Session[],
  excludeId?: string,
): MetricAverages | null {
  const pool = sessions.filter((s) => s.sessionId !== excludeId)
  if (pool.length < MIN_SESSIONS_FOR_AVERAGE) return null

  return {
    count: pool.length,
    wordsPerMinute: mean(pool.map((s) => s.wordsPerMinute)),
    fillerCount: mean(pool.map((s) => s.fillerCount)),
    fillersPerMinute: mean(pool.map((s) => s.fillersPerMinute)),
    longestPause: mean(pool.map((s) => s.longestPause)),
    bloatRatio: nullableMean(pool.map((s) => s.bloatRatio)),
    timeToFirstPoint: nullableMean(pool.map((s) => s.timeToFirstPoint)),
  }
}
