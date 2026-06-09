import { useState } from 'react'
import './App.css'

function App() {

  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

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


  return (
    <section id="center">
      <h1>Speakle!</h1>
      <p>Upload a recording to transcribe it.</p>

      <input
        type="file"
        accept="audio/*,video/*"
        onChange={handleFileChange}
      />

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
