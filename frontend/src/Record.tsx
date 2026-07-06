import { useState, useRef, useEffect} from 'react'
import './Record.css'
import {useNavigate} from 'react-router-dom'
import Transcript from './Transcript'
import type { Prompt, TranscriptData } from './types'
import {prompts} from './Prompts'

function Record() {

  const transcriptionClickOffset = 0.2;
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<TranscriptData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [vidURL, setVidURL] = useState<string | null>(null)
  const [prompt, setPrompt] = useState<Prompt | null>(null)

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


  // Runs when the user clicks "Transcribe".
  async function handleUpload() {
    if (!file) return  // nothing picked yet, do nothing

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      // FormData is the browser's way to build a multipart/form-data body
      const formData = new FormData()
      // controller reads @RequestParam("file") MultipartFile file, hence name is 'file'
      formData.append('file', file)

      // The actual POST
      const res = await fetch('/api/sessions/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error(`Server responded ${res.status}`)
      }

      const text = await res.text()
      setResult(JSON.parse(text) as TranscriptData)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setPhase('review') 
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
      setFile(newFile);
    };

    mediaRecorder.current.start();   // listeners all set up, start recording
    setRecording(true);
  }

  function stopRecording() {
    // onstop handler from startRecording assembles file once final chunk lands
    mediaRecorder.current?.stop();
    setRecording(false);
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
        if (videoRef.current) {
          videoRef.current.srcObject = localStream;
        }

    }
    getMedia();

    return () => {
      // cleanup on unmount: stop webcam and recording if still going
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

  useEffect(() => {
    if (phase === 'prep' && secondsBeforeRec <= 0) {
      setPhase('recording');
    }
  }, [phase, secondsBeforeRec]);


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
      <video ref={videoRef} autoPlay playsInline muted>
        </video>
        
        {prompt && <p>Prompt: {prompt.text}</p>}

        <button type="button" onClick={() => recording ? stopRecording() : startRecording()}>
        {recording ? 'Stop' : 'Start'}
        </button>

        <button type="button" onClick={() => restartRecording()} disabled={!recording}>
        Restart
        </button>

        <button type="button" onClick={handleUpload} disabled={!file || loading || recording}>
        {loading ? 'Transcribing…' : 'Transcribe'}
        </button>
        </>)}


      {phase === 'review' && (<>
      {vidURL && result && <video ref={playbackRef} src={vidURL} controls></video>}
      {result && <Transcript words={result.words} onSeek={seekTime}></Transcript>}
      </>)}


      {error && <p style={{ color: 'red' }}>Error: {error}</p>}


    </section>
  )
}

export default Record
