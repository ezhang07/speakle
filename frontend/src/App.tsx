import './App.css'
import Record from './Record'
import Sessions from './Sessions'
import Home from './Home'
import Login from './Login'
import Register from './Register'
import RequireAuth from './RequireAuth'
import { Routes, Route } from 'react-router-dom'

function App() {

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected routes */}
      <Route element={<RequireAuth />}>
        <Route path="/record" element={<Record />} />
        <Route path="/sessions" element={<Sessions />} />
      </Route>
    </Routes>
  )
}

export default App
