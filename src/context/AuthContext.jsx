import { createContext, useContext, useState, useCallback } from 'react'
import { api } from '../lib/api'

const AuthContext = createContext(null)

const TOKEN_KEY   = 'pkx_token'
const REFRESH_KEY = 'pkx_refresh'
const USER_KEY    = 'pkx_user'

function loadUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(loadUser)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  const register = useCallback(async (name, email, password) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/auth/register', { name, email, password })
      localStorage.setItem(TOKEN_KEY,   res.data.token)
      localStorage.setItem(REFRESH_KEY, res.data.refresh_token)
      localStorage.setItem(USER_KEY,    JSON.stringify(res.data.user))
      setUser(res.data.user)
      return res.data.user
    } catch (err) {
      setError(err.message ?? 'Error al registrarse')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const login = useCallback(async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/auth/login', { email, password })
      localStorage.setItem(TOKEN_KEY,   res.data.token)
      localStorage.setItem(REFRESH_KEY, res.data.refresh_token)
      localStorage.setItem(USER_KEY,    JSON.stringify(res.data.user))
      setUser(res.data.user)
      return res.data.user
    } catch (err) {
      setError(err.message ?? 'Error al iniciar sesión')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
    setUser(null)
    setError(null)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      loading,
      error,
      login,
      register,
      logout,
      clearError,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
