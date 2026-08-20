import './Auth.css'
import { useState, type SubmitEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

function Register() {
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    async function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
        e.preventDefault();
        setError('');

        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (res.status === 409) {
            setError('That email is already registered.');
            return;
        }
        if (!res.ok) {
            setError('Something went wrong. Please try again.');
            return;
        }

        // Register returns 201 with no token — send them to log in.
        navigate('/login');
    }

    return (
        <div className="auth">
            <div className="auth-card rise">
                <h1>Create an account</h1>

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
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </label>

                    {error && <p className="error-note">{error}</p>}

                    <button type="submit" className="btn btn-primary btn-lg auth-submit">
                        Create account
                    </button>
                </form>

                <p className="auth-alt muted">
                    Already have an account? <Link to="/login">Log in</Link>
                </p>
            </div>
        </div>
    )
}

export default Register
