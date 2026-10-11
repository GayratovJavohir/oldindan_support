const ACCESS = 'access_token'
const LEGACY_ACCESS = 'token'
const REFRESH = 'refresh_token'
const AGENT_NAME = 'agent_name'

export const AGENT_EVENT = 'support:agent'
export const UNAUTHORIZED_EVENT = 'support:unauthorized'
export const DEFAULT_AGENT_NAME = 'Support xodimi'

const read = (key) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key, value) => {
  try {
    if (value == null || value === '') localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* private mode / quota */
  }
}

export const getToken = () => read(ACCESS) || read(LEGACY_ACCESS) || ''
export const hasToken = () => !!getToken()
export const getRefreshToken = () => read(REFRESH) || ''

// refresh orqali yangilangan tokenlarni saqlaydi
export function setTokens(access, refresh) {
  write(ACCESS, access)
  if (refresh) write(REFRESH, refresh)
}

// JWT payload'dan foydalanuvchi ID'si (imzo tekshirilmaydi — faqat UI uchun)
export function getUserId() {
  try {
    const payload = getToken().split('.')[1]
    if (!payload) return null
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const id = JSON.parse(json).user_id
    return id == null ? null : String(id)
  } catch {
    return null
  }
}

export function getAgentName() {
  return read(AGENT_NAME) || DEFAULT_AGENT_NAME
}

export function setAgentName(name) {
  if (!name || read(AGENT_NAME) === name) return
  write(AGENT_NAME, name)
  window.dispatchEvent(new Event(AGENT_EVENT))
}

// login javobidan token va (bo'lsa) xodim ismini saqlaydi
export function saveSession(data) {
  const access = data?.access || data?.access_token || data?.token
  if (!access) return false
  write(ACCESS, access)
  write(REFRESH, data.refresh)
  const u = data.user || data
  const name = u?.full_name || [u?.first_name, u?.last_name].filter(Boolean).join(' ') || u?.name
  write(AGENT_NAME, name || null)
  return true
}

export function clearSession() {
  ;[ACCESS, LEGACY_ACCESS, REFRESH, AGENT_NAME].forEach((k) => write(k, null))
}
