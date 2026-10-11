import { REFRESH_URL } from '../config/env'
import {
  UNAUTHORIZED_EVENT,
  clearSession,
  getRefreshToken,
  getToken,
  setTokens,
} from './auth'

const authHeaders = () => {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

// Bir vaqtda ko'p so'rov 401 olsa, refresh bitta marta chaqiriladi
let refreshing = null

function refreshAccess() {
  const refresh = getRefreshToken()
  if (!refresh) return Promise.resolve(false)

  if (!refreshing) {
    refreshing = fetch(REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refresh }),
    })
      .then(async (res) => {
        if (!res.ok) return false
        const data = await res.json().catch(() => null)
        if (!data?.access) return false
        setTokens(data.access, data.refresh)
        return true
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

/**
 * fetch + Bearer token. 401 bo'lsa: refresh token bilan bir marta yangilab, so'rovni takrorlaydi.
 * Yangilab bo'lmasa — sessiya tozalanadi va `support:unauthorized` hodisasi yuboriladi.
 */
export async function http(url, options = {}) {
  const send = () =>
    fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } })

  let res = await send()

  if (res.status === 401 && (await refreshAccess())) {
    res = await send()
  }

  if (res.status === 401) {
    clearSession()
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
  }
  return res
}

export async function readJson(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
