import './App.css'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { AuthResponse } from './types'

function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    async function handleSubmit(e: React.SubmitEvent) {
        e.preventDefault();
        setError('');

        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            setError('Invalid email or password.');
            return;
        }

        const data = await res.json() as AuthResponse;
        login(data.token);
        navigate('/');
    }

    return (
        <div className="auth">
            <h1>Log in</h1>
            <form onSubmit={handleSubmit}>
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">Log in</button>
            </form>

            {error && <p className="auth-error">{error}</p>}

            <p>
                No account?{' '}
                <button type="button" onClick={() => navigate('/register')}>
                    Register
                </button>
            </p>
        </div>
    )
}

export default Login
