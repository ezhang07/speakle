import { useState, useRef, useEffect} from 'react'
import './App.css'
import Record from './Record.jsx'
import Sessions from './Sessions.jsx'
import { Routes, Route } from 'react-router-dom'

function App() {

  return (
    <Routes>
      <Route path="/" element={<Record />} />
      <Route path="/sessions" element={< Sessions />} />
    </Routes>
  )
}

export default App
