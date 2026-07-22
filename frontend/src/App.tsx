import './App.css'
import Record from './Record'
import Sessions from './Sessions'
import Home from './Home'
import Login from './Login'
import Register from './Register'
import { Routes, Route } from 'react-router-dom'

function App() {

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/record" element={<Record />} />
      <Route path="/sessions" element={<Sessions />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  )
}

export default App
