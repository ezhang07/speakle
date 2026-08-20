import './Home.css'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

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

function Home() {
  const navigate = useNavigate()
  const { token } = useAuth()

  /* ---------------------------------------------------- signed in ----- */

  if (token) {
    return (
      <div className="page home-signed-in rise">
        <h1>Ready when you are.</h1>

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
            <span className="action-card-desc">Re-watch a take and read the transcript.</span>
            <span className="action-card-go">Sessions &rarr;</span>
          </button>
        </div>
      </div>
    )
  }

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
