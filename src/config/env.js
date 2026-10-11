// Barcha import.meta.env o'qishlar shu yerda — qolgan kod faqat shu fayldan oladi.

const trim = (s) => (s || '').trim().replace(/\/+$/, '')
const env = import.meta.env

// '' (bo'sh) bo'lsa — so'rovlar joriy origin'ga ketadi (dev'da Vite proxy, prod'da nginx)
export const API_URL = trim(env.VITE_API_URL)

export const SUPPORT_API = `${API_URL}/api/support`
export const LOGIN_URL = `${API_URL}/api/accounts/support/login/`
export const REFRESH_URL = `${API_URL}${env.VITE_REFRESH_PATH || '/api/accounts/token/refresh/'}`

// WS asosi: avval VITE_SUPPORT_WS_URL, keyin VITE_API_URL (http→ws), oxirida joriy host
function wsBase() {
  const explicit = trim(env.VITE_SUPPORT_WS_URL)
  if (explicit) return explicit
  if (API_URL) return `${API_URL.replace(/^http/i, 'ws')}/ws/support`
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
  return `${proto}://${window.location.host}/ws/support`
}

export const buildSupportWsUrl = (ticketId, audience) =>
  `${wsBase()}/${ticketId}/${audience}/`
