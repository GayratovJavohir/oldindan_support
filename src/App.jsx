<<<<<<< HEAD
import { useCallback, useEffect, useState } from 'react'
import SupportPage from './pages/support/SupportPage'
import AdminLayout from './pages/support/AdminLayout'
import LoginPage from './pages/login/LoginPage'
import { UNAUTHORIZED_EVENT, clearSession, hasToken } from './lib/auth'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(hasToken)
=======
import { useEffect, useState } from 'react'
import SupportPage from './pages/support/SupportPage'
import AdminLayout from './pages/support/AdminLayout'
import LoginPage from './pages/login/LoginPage'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem('access_token'),
  )
>>>>>>> 101c5fa9d1643c85eb07cae0e2202472cb7f4066

  // Token muddati tugasa (401) — login sahifasiga qaytish
  useEffect(() => {
    const onUnauthorized = () => setIsAuthenticated(false)
<<<<<<< HEAD
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setIsAuthenticated(false)
=======
    window.addEventListener('support:unauthorized', onUnauthorized)
    return () => window.removeEventListener('support:unauthorized', onUnauthorized)
>>>>>>> 101c5fa9d1643c85eb07cae0e2202472cb7f4066
  }, [])

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  return (
<<<<<<< HEAD
    <AdminLayout onLogout={logout}>
      <SupportPage />
    </AdminLayout>
  )
}
=======
    <AdminLayout>
      <SupportPage />
    </AdminLayout>
  )
}
>>>>>>> 101c5fa9d1643c85eb07cae0e2202472cb7f4066
