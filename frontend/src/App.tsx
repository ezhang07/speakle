import Record from './Record'
import Sessions from './Sessions'
import Home from './Home'
import Login from './Login'
import Register from './Register'
import RequireAuth from './RequireAuth'
import Layout from './Layout'
import { Routes, Route } from 'react-router-dom'

function App() {

  return (
    <Routes>
      {/* Every route renders inside the app shell (top bar + main). */}
      <Route element={<Layout />}>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected routes */}
        <Route element={<RequireAuth />}>
          <Route path="/record" element={<Record />} />
          <Route path="/sessions" element={<Sessions />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
