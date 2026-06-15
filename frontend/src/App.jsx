import { useState, useRef, useEffect} from 'react'
import './App.css'

function App() {

  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [recording, setRecording] = useState(false)


  const constraints = { audio: true, video: { width: 1280, height: 720, resizeMode: "crop-and-scale"} };
  const videoRef = useRef(null);
  const stream = useRef(null);
  const chunks = useRef([]);
  const mediaRecorder = useRef(null);
  const restartRec = useRef(false);

  // Runs when file input is changed from file select
  function handleFileChange(e) {
    setFile(e.target.files[0])
    setResult(null)   // clear any old transcript when a new file is chosen
    setError(null)
  }

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


  // webcam recording
  async function getMedia(constraints) {

    try {
      stream.current = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream.current;
      }
      
      // Do something with the stream, e.g., display it in a video element
    } catch (err) {
      console.error('Error accessing media devices.', err);
    }
  }

  function startRecording() {
    if (!stream.current) {
      console.error('No media stream yet');
      return;
    }

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

  useEffect(() => {
    getMedia(constraints);

    return () => {
      // cleanup on unmount: stop webcam and recording if still going
      if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
        mediaRecorder.current.stop();
      }
      if (stream.current) {
        stream.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <section id="center">
      <h1>Speakle!</h1>
      <p>Upload a recording to transcribe it.</p>
      <button type="button" onClick={() => getMedia(constraints)}>
        Record from Webcam
      </button>
      <video ref={videoRef} autoPlay playsInline muted>
      </video>
      <input
        type="file"
        accept="audio/*,video/*"
        onChange={handleFileChange}
      />
      <button type="button" onClick={() => startRecording()} disabled={recording}>
        Start Recording
      </button>
      <button type="button" onClick={() => stopRecording()} disabled={!recording}>
        Stop Recording
      </button>
      <button type="button" onClick={() => restartRecording()} disabled={!recording}>
        Restart Recording
        </button>
      <button type="button" onClick={handleUpload} disabled={!file || loading}>
        {loading ? 'Transcribing…' : 'Transcribe'}
      </button>


      {error && <p style={{ color: 'red' }}>Error: {error}</p>}

      {result && (
        <div style={{ textAlign: 'left', marginTop: '1rem' }}>
          <h2>Transcript</h2>
          <p>{result.text}</p>
        </div>
      )}
    </section>
  )
}

export default App
