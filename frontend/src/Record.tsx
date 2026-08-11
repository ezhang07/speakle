import { useState, useRef, useEffect} from 'react'
import './Record.css'
import {useNavigate} from 'react-router-dom'
import Transcript from './Transcript'
import Metrics from './Metrics'
import Feedback from './Feedback'
import type { Prompt, TranscriptData, Metrics as MetricsData, UploadUrlResponse, JobResponse, JobStatusResponse, Session } from './types'
import {prompts} from './Prompts'
import { useAuthedFetch } from './useAuthedFetch'

// how long between every poll request, plus max time we poll for in milliseconds
const POLL_INTERVAL_MS = 2000
const MAX_POLL_MS = 3 * 60 * 1000

// Promise that lets us `await sleep(...)` between polls.
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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

  const constraints: MediaStreamConstraints = { audio: true, video: { width: 1280, height: 720, resizeMode: "crop-and-scale"} };
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const restartRec = useRef(false);
  const playbackRef = useRef<HTMLVideoElement>(null);

  type Phase = 'setup' | 'prep' | 'recording' | 'review'
  const [phase, setPhase] = useState<Phase>('setup')
  const [secondsBeforeRec, setSecondsBeforeRec] = useState(15)

  const [secondsRecording, setSecondsRecording] = useState(20)



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

    setSecondsBeforeRec(15);

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

    setSecondsRecording(20);

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


  return (
    <section id="center">
      <h1>Speakle!</h1>
      <p>Record yourself speaking and figure out where you stumble.</p>

      <button type="button" onClick={() => navigate('/')}>
      Return back home
      </button>


      {phase === 'setup' && (<> <h3>Which type of prompt would you like to answer?</h3>
      <button type="button" onClick={() => {selectPrompt('casual')}}>Casual</button>
      <button type="button" onClick={() => {selectPrompt('behavioural')}}>Behavioural</button>
      </>)}

      {phase === 'prep' && (<>
      <h3>Prompt: {prompt?.text}</h3>
      <p>
        You have {secondsBeforeRec} seconds to prepare!
      </p>
      
      </>)}

      {phase === 'recording' && (<>  
      <h3>{secondsRecording}</h3>    

      <video ref={videoRef} autoPlay playsInline muted>
        </video>
        
        {prompt && <p>Prompt: {prompt.text}</p>}

        <button type="button" onClick={() => restartRecording()} disabled={!recording}>
        Restart
        </button>

        </>)}


      {phase === 'review' && (<>
      {loading && <h3>Transcribing...</h3>}
      {!loading && prompt && <h3>{prompt.text}</h3>}
      {vidURL && result && <video ref={playbackRef} src={vidURL} controls></video>}
      {result && metrics && (
        <Metrics
          wordsPerMinute={metrics.wordsPerMinute}
          fillerCount={metrics.fillerCount}
          fillersPerMinute={metrics.fillersPerMinute}
          longestPause={metrics.longestPause}
          longestPauseTimeStamp={metrics.longestPauseTimeStamp}
          bloatRatio={metrics.bloatRatio}
          timeToFirstPoint={metrics.timeToFirstPoint}
          onSeek={seekTime}
        />
      )}
      {result && <Transcript words={result.words} onSeek={seekTime}></Transcript>}
      </>)}

      {result && <Feedback summary={summary} />}

      {error && <p style={{ color: 'red' }}>Error: {error}</p>}


    </section>
  )
}

export default Record
