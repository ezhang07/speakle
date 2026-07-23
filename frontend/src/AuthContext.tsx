import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

interface AuthContextValue {
  token: string | null
  login: (token: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // reads token synchronously instead of useEffect
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))

  // Each function keeps disk + state in sync, always together
  const login = useCallback((newToken: string) => {
    localStorage.setItem('token', newToken)
    setToken(newToken)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setToken(null)
  }, [])

  // Memoize the value object so consumers only re-render when token actually changes
  const value = useMemo(() => ({ token, login, logout }), [token, login, logout])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// convenience hook so components call useAuth() instead of useContext(AuthContext)
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}