import './App.css'
import Record from './Record'
import Sessions from './Sessions'
import Home from './Home'
import { Routes, Route } from 'react-router-dom'

function App() {

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/record" element={<Record />} />
      <Route path="/sessions" element={<Sessions />} />
    </Routes>
  )
}

export default App
