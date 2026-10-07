import { useEffect, useState } from 'react'
import SupportPage from './pages/support/SupportPage'
import AdminLayout from './pages/support/AdminLayout'
import LoginPage from './pages/login/LoginPage'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => !!localStorage.getItem('access_token'),
  )

  // Token muddati tugasa (401) — login sahifasiga qaytish
  useEffect(() => {
    const onUnauthorized = () => setIsAuthenticated(false)
    window.addEventListener('support:unauthorized', onUnauthorized)
    return () => window.removeEventListener('support:unauthorized', onUnauthorized)
  }, [])

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={() => setIsAuthenticated(true)} />
  }

  return (
    <AdminLayout>
      <SupportPage />
    </AdminLayout>
  )
}