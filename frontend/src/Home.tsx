import './Home.css'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { useAuthedFetch } from './useAuthedFetch'
import type { Session } from './types'

/** "3 days ago", "yesterday", "now" — via Intl, so no date library. */
function relativeTime(iso: string): string {
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['second', 60],
    ['minute', 60],
    ['hour', 24],
    ['day', 30],
    ['month', 12],
  ]

  // Negative = in the past, which is what RelativeTimeFormat expects.
  let value = (new Date(iso).getTime() - Date.now()) / 1000

  for (const [unit, step] of units) {
    if (Math.abs(value) < step) return rtf.format(Math.round(value), unit)
    value /= step
  }
  return rtf.format(Math.round(value), 'year')
}

/** A frozen slice of the review screen. A transcript with the fillers picked
 *  out explains this app faster than any amount of copy. */
function TranscriptPreview() {
  return (
    <div className="preview" aria-hidden="true">
      <div className="preview-bar">
        <span className="preview-dot" />
        <span className="preview-dot" />
        <span className="preview-dot" />
      </div>

      <div className="preview-body">
        <p className="preview-transcript">
          So, <mark>um</mark>, I think the biggest thing I learned was,{' '}
          <mark>like</mark>, you have to ask for help earlier than feels
          comfortable. <mark>Uh</mark>, on my last project I spent,{' '}
          <mark>like</mark>, three days stuck on something a teammate solved in
          ten minutes.
        </p>

        <div className="preview-stats">
          <div className="preview-stat">
            <span className="preview-stat-value tabular">4</span>
            <span className="meta">Fillers</span>
          </div>
          <div className="preview-stat">
            <span className="preview-stat-value tabular">138</span>
            <span className="meta">Words / min</span>
          </div>
          <div className="preview-stat">
            <span className="preview-stat-value tabular">2.4s</span>
            <span className="meta">Longest pause</span>
          </div>
        </div>
      </div>
    </div>
  )
}

const STEPS = [
  {
    title: 'Get a prompt',
    body: 'Fifteen seconds to think, then it starts recording.',
  },
  {
    title: 'Talk for a minute',
    body: 'As if you were in a conversation.',
  },
  {
    title: 'Review',
    body: 'Playback video, highlighted fillers, all the metrics you could need.',
  },
]

/** The signed-in landing. Its own component so the sessions fetch only ever
 *  runs for signed-in visitors, and so the hooks aren't behind a conditional. */
function SignedInHome() {
  const navigate = useNavigate()
  const authedFetch = useAuthedFetch()

  // null = still loading. An empty array is a real, different answer.
  const [sessions, setSessions] = useState<Session[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await authedFetch('/api/sessions')
        if (!res.ok) throw new Error()
        const data = await res.json() as Session[]
        if (!cancelled) setSessions(data)
      } catch {
        // The heading is decoration over data — if it fails, fall back to a
        // plain one rather than showing an error on the home page.
        if (!cancelled) setFailed(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [authedFetch])

  // The backend now sorts newest-first, but don't depend on it for a fact
  // stated on screen — take the max explicitly.
  const latest = sessions?.length
    ? sessions.reduce((a, b) => (a.createdAt > b.createdAt ? a : b))
    : null

  function greeting() {
    if (failed) return <h1>Practice.</h1>

    if (sessions === null) {
      return (
        <>
          <span className="skeleton skeleton-line home-greeting-skeleton" />
          <span className="skeleton skeleton-line home-greeting-sub" />
        </>
      )
    }

    if (sessions.length === 0) {
      return (
        <>
          <h1>No sessions yet.</h1>
          <p className="meta">Record your first one below.</p>
        </>
      )
    }

    return (
      <>
        <h1>
          <span className="tabular">{sessions.length}</span>{' '}
          session{sessions.length === 1 ? '' : 's'} so far.
        </h1>
        {latest && (
          <p className="meta">Last one {relativeTime(latest.createdAt)}.</p>
        )}
      </>
    )
  }

  return (
    <div className="page home-signed-in rise">
      <div className="home-greeting">{greeting()}</div>

      <div className="home-actions">
          <button
            type="button"
            className="action-card action-card-primary"
            onClick={() => navigate('/record')}
          >
            <span className="action-card-title">Start a session</span>
            <span className="action-card-desc">Pick a prompt and record an answer.</span>
            <span className="action-card-go">Record &rarr;</span>
          </button>

          <button
            type="button"
            className="action-card"
            onClick={() => navigate('/sessions')}
          >
            <span className="action-card-title">Past sessions</span>
            <span className="action-card-desc">Re-watch and review.</span>
            <span className="action-card-go">Sessions &rarr;</span>
          </button>
      </div>
    </div>
  )
}

function Home() {
  const { token } = useAuth()

  if (token) return <SignedInHome />

  /* --------------------------------------------------- signed out ----- */

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-copy">
          <h1 className="hero-title">Welcome to Speakle.</h1>
          <p className="hero-lede">
            Inspired from a trend on Instagram Reels, Speakle aims to help people improve their daily speech,
            but with less friction and a more systematic way of reviewing progress.
          </p>

          <div className="row hero-actions">
            <Link to="/register" className="btn btn-primary btn-lg">
              Get started
            </Link>
            <Link to="/login" className="btn btn-lg">
              Log in
            </Link>
          </div>
        </div>
        

        <TranscriptPreview />
      </section>

      <section className="steps">
        <h1 className="steps-head">How it works</h1>

        <div className="steps-grid">
          {STEPS.map((s) => (
            <div className="step" key={s.title}>
              <h3>{s.title}</h3>
              <p className="muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Home
