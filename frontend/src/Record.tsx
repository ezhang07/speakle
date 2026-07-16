import { useState, useRef, useEffect} from 'react'
import './Record.css'
import {useNavigate} from 'react-router-dom'
import Transcript from './Transcript'
import Metrics from './Metrics'
import Feedback from './Feedback'
import type { Prompt, TranscriptData, Metrics as MetricsData, TranscribeResponse } from './types'
import {prompts} from './Prompts'

function Record() {

  const transcriptionClickOffset = 0.2;
  const navigate = useNavigate();

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



  // Runs when the user clicks "Transcribe".
  async function handleUpload(f: File) {
    if (!f) return  // nothing picked yet, do nothing

    setLoading(true)
    setError(null)
    setResult(null)
    setMetrics(null)

    try {
      // FormData is the browser's way to build a multipart/form-data body
      const formData = new FormData()
      // controller reads @RequestParam("file") MultipartFile file, hence name is 'file'
      formData.append('file', f)
      if (prompt) {
        formData.append('promptText', prompt.text)
        formData.append('promptCategory', prompt.category)
      }

      // The actual POST
      const res = await fetch('/api/sessions/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`Server responded ${res.status}`)
      }

      const text = await res.text()
      const data = JSON.parse(text) as TranscribeResponse
      setResult(data.transcript)
      setMetrics(data.metrics)
      setSummary(data.summary)
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
