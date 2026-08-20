import './Auth.css'
import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import type { AuthResponse } from './types'

function Login() {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
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
            <div className="auth-card rise">
                <h1>Log in</h1>

                <form onSubmit={handleSubmit} className="auth-form">
                    <label className="auth-field">
                        <span className="meta">Email</span>
                        <input
                            className="input"
                            type="email"
                            placeholder="you@example.com"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </label>

                    <label className="auth-field">
                        <span className="meta">Password</span>
                        <input
                            className="input"
                            type="password"
                            placeholder="••••••••"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </label>

                    {error && <p className="error-note">{error}</p>}

                    <button type="submit" className="btn btn-primary btn-lg auth-submit">
                        Log in
                    </button>
                </form>

                <p className="auth-alt muted">
                    No account? <Link to="/register">Create one</Link>
                </p>
            </div>
        </div>
    )
}

export default Login
