import { useState, useRef, useEffect} from 'react'
import './Record.css'
import {useNavigate} from 'react-router-dom'
import Transcript from './Transcript.jsx'

function Record() {

  const transcriptionClickOffset = 0.2;
  const fillerWords = new Set(['um', 'uh', 'like']);
  const navigate = useNavigate();

  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [recording, setRecording] = useState(false)
  const [vidURL, setVidURL] = useState(null)

  const constraints = { audio: true, video: { width: 1280, height: 720, resizeMode: "crop-and-scale"} };
  const videoRef = useRef(null);
  const stream = useRef(null);
  const chunks = useRef([]);
  const mediaRecorder = useRef(null);
  const restartRec = useRef(false);
  const playbackRef = useRef(null);


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
      setResult(JSON.parse(text)) 
    } catch (err) {
      setError(err.message)
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
      setFile(newFile);
    };

    mediaRecorder.current.start();   // listeners all set up, start recording
    setRecording(true);
  }

  function stopRecording() {
    // onstop handler from startRecording assembles file once final chunk lands
    mediaRecorder.current.stop();
    setRecording(false);
  }

  function restartRecording() {
    restartRec.current = true;
    mediaRecorder.current.stop();
  }

  function isFiller(word) {
    return fillerWords.has(word.toLowerCase().replace(/[^a-z]/g, ''));
  }

  useEffect(() => {
    let cancelled = false;
    let localStream = null;

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
  }, []);

  function seekTime(time) {
    playbackRef.current.currentTime = Math.max(0, time - transcriptionClickOffset);
    playbackRef.current.play();
  }

  return (
    <section id="center">
      <h1>Speakle!</h1>
      <p>Record yourself speaking and figure out where you stumble.</p>

      <button type="button" onClick={() => navigate('/')}>
      Return back home
      </button>
      
      <video ref={videoRef} autoPlay playsInline muted
        style={{ display: result ? 'none' : 'block' }}>
        </video>
      {vidURL && result && <video ref={playbackRef} src={vidURL} controls></video>}
      <button type="button" onClick={() => recording ? stopRecording() : startRecording()}>
        {recording ? 'Stop' : 'Start'}
      </button>
      <button type="button" onClick={() => restartRecording()} disabled={!recording}>
        Restart
        </button>
      <button type="button" onClick={handleUpload} disabled={!file || loading || recording}>
        {loading ? 'Transcribing…' : 'Transcribe'}
      </button>


      {error && <p style={{ color: 'red' }}>Error: {error}</p>}


      {result && <Transcript words={result.words} onSeek={seekTime}></Transcript>}
      
    </section>
  )
}

export default Record