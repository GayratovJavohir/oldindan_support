import { useCallback, useEffect, useState } from 'react'
import SupportPage from './pages/support/SupportPage'
import AdminLayout from './pages/support/AdminLayout'
import LoginPage from './pages/login/LoginPage'
import { UNAUTHORIZED_EVENT, clearSession, hasToken } from './lib/auth'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasToken)

  // Token muddati tugasa (401) — login sahifasiga qaytish
  useEffect(() => {
    const onUnauthorized = () => setIsAuthenticated(false)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setIsAuthenticated(false)
  }, [])

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  return (
    <AdminLayout onLogout={logout}>
      <SupportPage />
    </AdminLayout>
  )
}
