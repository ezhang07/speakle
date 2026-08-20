import { useState, useRef, useEffect} from 'react'
import './Record.css'
import './Review.css'
import {useNavigate} from 'react-router-dom'
import Transcript from './Transcript'
import Metrics from './Metrics'
import Feedback from './Feedback'
import type { Prompt, TranscriptData, Metrics as MetricsData, UploadUrlResponse, JobResponse, JobStatusResponse, Session } from './types'
import {prompts} from './Prompts'
import { useAuthedFetch } from './useAuthedFetch'
import { computeAverages } from './averages'

// how long between every poll request, plus max time we poll for in milliseconds
const POLL_INTERVAL_MS = 2000
const MAX_POLL_MS = 3 * 60 * 1000

// Length of each phase, in seconds.
const PREP_SECONDS = 15
const RECORDING_SECONDS = 20

// Promise that lets us `await sleep(...)` between polls.
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds)
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`
}

// Circumference of the countdown ring (r=54), so the dash offset can be driven
// straight from the seconds remaining.
const RING = 2 * Math.PI * 54

function Record() {

  const transcriptionClickOffset = 0.2;
  const navigate = useNavigate();
  const authedFetch = useAuthedFetch();

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TranscriptData | null>(null)
  const [metrics, setMetrics] = useState<MetricsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [vidURL, setVidURL] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const [summary, setSummary] = useState<string | null>(null)

  // Past sessions, loaded once on mount purely so the review screen can say
  // "vs your average". Never blocks the recording flow.
  const [history, setHistory] = useState<Session[]>([])

  const constraints: MediaStreamConstraints = { audio: true, video: { width: 1280, height: 720, resizeMode: "crop-and-scale"} };
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const restartRec = useRef(false);
  const playbackRef = useRef<HTMLVideoElement>(null);

  type Phase = 'setup' | 'prep' | 'recording' | 'review'
  const [phase, setPhase] = useState<Phase>('setup')
  const [secondsBeforeRec, setSecondsBeforeRec] = useState(PREP_SECONDS)

  const [secondsRecording, setSecondsRecording] = useState(RECORDING_SECONDS)

  const averages = computeAverages(history)



  // Runs when a recording finishes. Kicks off the transcription job, polls until
  // it's done, then loads the finished session into the review screen.
  async function handleUpload(f: File) {
    if (!f) return  // nothing recorded yet, do nothing

    setLoading(true)
    setError(null)
    setResult(null)
    setMetrics(null)

    try {
      // 1. Ask the backend for a presigned S3 upload URL + the key it minted.
      const urlRes = await authedFetch('/api/sessions/upload-url', { method: 'POST' })
      if (!urlRes.ok) {
        throw new Error(`Could not get upload URL: ${urlRes.status}`)
      }
      const { uploadUrl, videoKey } = (await urlRes.json()) as UploadUrlResponse

      // 2. PUT the video straight to S3 — no backend, no auth header (the signed URL IS the
      //    credential; adding a Bearer token would break the signature). Raw File as the body.
      const s3Res = await fetch(uploadUrl, { method: 'PUT', body: f })
      if (!s3Res.ok) {
        throw new Error(`Upload to S3 failed: ${s3Res.status}`)
      }

      // 3. Tell the backend the video is in S3 under videoKey; it creates a job and returns jobId.
      const res = await authedFetch('/api/sessions/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoKey,
          promptText: prompt?.text ?? '',
          promptCategory: prompt?.category ?? '',
        }),
      })
      if (!res.ok) {
        throw new Error(`Server responded ${res.status}`)
      }
      const { jobId } = (await res.json()) as JobResponse

      // Poll the job until it completes (or we hit the time cap)
      const deadline = Date.now() + MAX_POLL_MS
      let finished: JobStatusResponse | null = null
      while (Date.now() < deadline) {
        const jobRes = await authedFetch(`/api/jobs/${jobId}`)
        if (!jobRes.ok) {
          throw new Error(`Job poll failed: ${jobRes.status}`)
        }
        const job = (await jobRes.json()) as JobStatusResponse

        if (job.status === 'COMPLETED') { finished = job; break }
        if (job.status === 'FAILED') { throw new Error('Transcription failed') }

        // still PENDING/PROCESSING, delay until next request
        await sleep(POLL_INTERVAL_MS)
      }
      if (!finished) {
        throw new Error('Transcription timed out')
      }
      if (!finished.resultSessionId) {
        throw new Error('Completed job has no session')
      }

      // job is completed, fetch the finished session by the id the job points at
      const sessionRes = await authedFetch(`/api/sessions/${finished.resultSessionId}`)
      if (!sessionRes.ok) {
        throw new Error(`Failed to load session: ${sessionRes.status}`)
      }
      const session = (await sessionRes.json()) as Session

      // take session and turn into everything needed for playback review
      setResult(JSON.parse(session.transcript) as TranscriptData)
      setMetrics({
        durationSeconds: session.durationSeconds,
        wordsPerMinute: session.wordsPerMinute,
        fillerCount: session.fillerCount,
        fillersPerMinute: session.fillersPerMinute,
        longestPause: session.longestPause,
        longestPauseTimeStamp: session.longestPauseTimeStamp,
        bloatRatio: session.bloatRatio,
        timeToFirstPoint: session.timeToFirstPoint,
      })
      setSummary(session.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }


  function startRecording() {
    if (!stream.current) {
      console.error('No media stream yet');
      return;
    }

    setResult(null);
    chunks.current = [];   // empty the memory so this take doesn't include last recording
    mediaRecorder.current = new MediaRecorder(stream.current);

    // recorder essentially takes snapshots, through chunks, so every new snapshot we add to the chunks array
    mediaRecorder.current.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunks.current.push(e.data);
      }
    };

    // will run only when stop is called and the final chunk has arrived -> chunks complete, can assemble file
    mediaRecorder.current.onstop = () => {
      if (restartRec.current) {
        console.log('Restart');
        restartRec.current = false;
        startRecording();
        return;
      }
      console.log('Finalize');

      const blob = new Blob(chunks.current, { type: 'video/webm' });
      setVidURL(URL.createObjectURL(blob));

      const newFile = new File([blob], 'recording.webm', { type: 'video/webm' });
      handleUpload(newFile);
    };

    mediaRecorder.current.start();   // listeners all set up, start recording
    setRecording(true);
  }

  function stopRecording() {
    // onstop handler from startRecording assembles file once final chunk lands
    mediaRecorder.current?.stop();
  }

  function restartRecording() {
    restartRec.current = true;
    mediaRecorder.current?.stop();
  }

  // Same sequence the auto-stop timer runs, just triggered by the user.
  function finishRecording() {
    setPhase('review');
    stopRecording();
    setRecording(false);
  }

  // Back to the start for another take.
  function reset() {
    if (vidURL) URL.revokeObjectURL(vidURL);
    setVidURL(null);
    setResult(null);
    setMetrics(null);
    setSummary(null);
    setError(null);
    setPrompt(null);
    setPhase('setup');
  }

  function seekTime(time: number) {
    if (!playbackRef.current) return;
    playbackRef.current.currentTime = Math.max(0, time - transcriptionClickOffset);
    playbackRef.current.play();
  }

  function selectPrompt(cat: 'casual' | 'behavioural') {
    const filteredPrompts = prompts.filter(p => p.category === cat);
    setPrompt(filteredPrompts[Math.floor(Math.random() * filteredPrompts.length)]);
    setPhase('prep');
  }

  // Load past sessions once, for the "vs your average" comparison on review.
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await authedFetch('/api/sessions');
        if (!res.ok) return;
        setHistory(await res.json() as Session[]);
      } catch {
        // The comparison is a nicety — never let it break recording.
      }
    }
    loadHistory();
  }, [authedFetch]);

  useEffect(() => {
    if (phase !== 'recording') return; // only run once we are in the recording phase


    let cancelled = false;
    let localStream: MediaStream | null = null;

      // webcam recording
    async function getMedia() {
        const strm = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          strm.getTracks().forEach(track => track.stop());
          return;
        }
        localStream = strm;
        stream.current = strm;
        startRecording();
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
        }

    }
    getMedia();

    // cleanup on unmount: stop webcam and recording if still going
    return () => {
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      cancelled = true;
      console.log('Cleanup done');
    };
  }, [phase]);

  // 15s timer for user after selecting prompt, prep for 20 seconds before auto-starting rec
  useEffect(() => {
    if (phase !== 'prep') return;

    setSecondsBeforeRec(PREP_SECONDS);

    const id = setInterval(() => {
      setSecondsBeforeRec(s => s - 1);
    }, 1000);

    return () => clearInterval(id);
  }, [phase]);

  // once 15s is up, change to recording phase, start recording
  useEffect(() => {
    if (phase === 'prep' && secondsBeforeRec <= 0) {
      setPhase('recording');
      }
  }, [phase, secondsBeforeRec]);


  // 60s timer for recording
  useEffect(() => {
    if (!recording) return;

    setSecondsRecording(RECORDING_SECONDS);

    const id = setInterval(() => {
      setSecondsRecording(s => s - 1);
    }, 1000);

    return () => clearInterval(id);
  }, [recording]);

  // once 60 seconds is up, change to review phase, stop the recording
  useEffect(() => {
    if (phase === 'recording' && secondsRecording <= 0) {
      setPhase('review');
      stopRecording();
      setRecording(false);
    }
  }, [phase, secondsRecording]);


  /* ================================================================ setup */

  if (phase === 'setup') {
    return (
      <div className="page record-setup rise">
        <h1>Pick a prompt</h1>
        <p className="record-lede">
          You get {PREP_SECONDS} seconds to think, then the camera starts on its
          own and records for {RECORDING_SECONDS} seconds.
        </p>

        <div className="prompt-choice">
          <button type="button" className="prompt-card" onClick={() => selectPrompt('casual')}>
            <span className="prompt-card-title">Casual</span>
            <span className="prompt-card-desc">
              Practice your speech in a conversational setting. 
            </span>
          </button>

          <button type="button" className="prompt-card" onClick={() => selectPrompt('behavioural')}>
            <span className="prompt-card-title">Behavioural</span>
            <span className="prompt-card-desc">
              Practice your speech in an interview setting.
            </span>
          </button>
        </div>
      </div>
    )
  }

  /* ================================================================= prep */

  if (phase === 'prep') {
    return (
      <div className="stage stage-prep">
        <div className="stage-inner">
          <p className="stage-prompt">{prompt?.text}</p>

          <div className="countdown">
            <svg className="countdown-ring" viewBox="0 0 120 120" aria-hidden="true">
              <circle className="ring-track" cx="60" cy="60" r="54" />
              <circle
                className="ring-fill"
                cx="60"
                cy="60"
                r="54"
                style={{
                  strokeDasharray: RING,
                  strokeDashoffset: RING * (1 - Math.max(0, secondsBeforeRec) / PREP_SECONDS),
                }}
              />
            </svg>
            <span className="countdown-num tabular">{Math.max(0, secondsBeforeRec)}</span>
          </div>

          <p className="muted">Recording starts automatically.</p>
        </div>
      </div>
    )
  }

  /* ============================================================ recording */

  if (phase === 'recording') {
    return (
      <div className="stage stage-recording">
        <div className="stage-bar">
          <span className="live">
            <i className="live-dot" aria-hidden="true" />
            Recording
          </span>
          <span className="stage-timer tabular">{formatClock(secondsRecording)}</span>
        </div>

        <video ref={videoRef} className="stage-video" autoPlay playsInline muted />

        <div className="stage-bar stage-bar-foot">
          <p className="stage-prompt-small">{prompt?.text}</p>
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={restartRecording} disabled={!recording}>
              Restart
            </button>
            <button type="button" className="btn btn-primary" onClick={finishRecording} disabled={!recording}>
              Finish
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* =============================================================== review */

  return (
    <div className="page rise">
      {loading && (
        <div className="transcribing">
          <div className="transcribing-wave" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
          <h1>Transcribing</h1>
          <p className="muted">This usually takes about half a minute.</p>
          {prompt && <p className="transcribing-prompt">&ldquo;{prompt.text}&rdquo;</p>}
        </div>
      )}

      {!loading && error && (
        <div className="empty">
          <h2>That take didn&rsquo;t go through</h2>
          <p className="error-note transcribing-error">{error}</p>
          <button type="button" className="btn btn-primary" onClick={reset}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && result && metrics && (
        <>
          <div className="review-prompt">
            {prompt && <span className="meta review-prompt-meta">{prompt.category}</span>}
            <h1 className="review-prompt-text">{prompt?.text}</h1>
          </div>

          <div className="review">
            <div className="review-media">
              {vidURL && (
                <video ref={playbackRef} className="review-video" src={vidURL} controls />
              )}
              <div className="review-media-foot">
                <button type="button" className="btn btn-sm" onClick={reset}>
                  Record another
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/sessions')}>
                  All sessions &rarr;
                </button>
              </div>
            </div>

            <div className="review-body">
              <Metrics
                wordsPerMinute={metrics.wordsPerMinute}
                fillerCount={metrics.fillerCount}
                fillersPerMinute={metrics.fillersPerMinute}
                longestPause={metrics.longestPause}
                longestPauseTimeStamp={metrics.longestPauseTimeStamp}
                bloatRatio={metrics.bloatRatio}
                timeToFirstPoint={metrics.timeToFirstPoint}
                averages={averages}
                onSeek={seekTime}
              />
              <Transcript words={result.words} onSeek={seekTime} />
              <Feedback summary={summary} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Record
