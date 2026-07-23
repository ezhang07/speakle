import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

// fetch wrapper for authenticated calls, attaches beare token and if token is dead/expired, perform necessary logic
export function useAuthedFetch() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  return useCallback(async (url: string, options: RequestInit = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (res.status === 401) {
      logout();
      navigate('/login');
      throw new Error('Unauthorized');
    }

    return res;
  }, [token, logout, navigate]);
}
