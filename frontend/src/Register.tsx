import './App.css'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Register() {
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    async function handleSubmit(e: React.SubmitEvent) {
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
            <h1>Register</h1>
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
                <button type="submit">Register</button>
            </form>

            {error && <p className="auth-error">{error}</p>}

            <p>
                Already have an account?{' '}
                <button type="button" onClick={() => navigate('/login')}>
                    Log in
                </button>
            </p>
        </div>
    )
}

export default Register
