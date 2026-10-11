import { getToken } from '../lib/auth'

const MAX_FAILED_ATTEMPTS = 5
const HEARTBEAT_MS = 25000
// backend rad etgan kodlar (consumers.py): 4401 — auth yo'q/token eskirgan, 4403 — ruxsat yo'q
const CODE_UNAUTHORIZED = 4401
const CODE_FORBIDDEN = 4403

const buildUrl = (url) => {
    const token = getToken()
    if (!token) return url
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}token=${encodeURIComponent(token)}`
}

/**
 * onUnauthorized: async () => boolean — 4401 da tokenni yangilashga urinadi
 * (true qaytarsa darhol qayta ulanadi; ketma-ket xato uchun faqat bir marta).
 */
export function createSupportSocket({ url, onEvent, onStatus, onUnauthorized }) {
    if (!url) {
        onStatus?.('disabled')
        return { send() { }, close() { } }
    }

    let ws = null
    let closed = false
    let retry = 0
    let failures = 0
    let authTried = false
    let timer = null
    let heartbeat = null

    const stopHeartbeat = () => {
        clearInterval(heartbeat)
        heartbeat = null
    }

    const scheduleReconnect = () => {
        if (closed) return

        failures += 1
        if (failures >= MAX_FAILED_ATTEMPTS) {
            console.info('[supportSocket] WS ulanmadi, to‘xtatildi (polling ishlaydi)')
            onStatus?.('disabled')
            return
        }

        onStatus?.('reconnecting')
        retry += 1
        timer = setTimeout(connect, Math.min(1000 * 2 ** retry, 15000))
    }

    const connect = () => {
        if (closed) return
        onStatus?.(retry ? 'reconnecting' : 'connecting')

        let socket
        try {
            socket = new WebSocket(buildUrl(url))
        } catch (error) {
            console.error('[supportSocket] Connection error:', error)
            onStatus?.('error')
            scheduleReconnect()
            return
        }
        ws = socket

        socket.onopen = () => {
            retry = 0
            failures = 0
            authTried = false
            onStatus?.('connected')
            stopHeartbeat()
            heartbeat = setInterval(() => {
                if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ action: 'ping' }))
            }, HEARTBEAT_MS)
        }

        socket.onmessage = (event) => {
            try {
                onEvent?.(JSON.parse(event.data))
            } catch (error) {
                console.warn('[supportSocket] Invalid message:', error)
            }
        }

        socket.onclose = async (event) => {
            if (ws !== socket) return
            stopHeartbeat()

            if (event.code === CODE_FORBIDDEN) {
                console.warn('[supportSocket] Ruxsat yo‘q (4403)')
                onStatus?.('disabled')
                return
            }

            if (event.code === CODE_UNAUTHORIZED) {
                if (onUnauthorized && !authTried) {
                    authTried = true
                    const ok = await onUnauthorized().catch(() => false)
                    if (closed || ws !== socket) return
                    if (ok) {
                        timer = setTimeout(connect, 0)
                        return
                    }
                }
                console.warn('[supportSocket] Auth rad etildi (4401)')
                onStatus?.('disabled')
                return
            }

            scheduleReconnect()
        }

        socket.onerror = () => {
            try { socket.close() } catch { /* yopilgan bo'lishi mumkin */ }
        }
    }

    // React StrictMode (dev): connect'ni kechiktiramiz, birinchi cleanup bekor qila olsin
    timer = setTimeout(connect, 0)

    return {
        send(payload) {
            if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload))
        },
        close() {
            closed = true
            clearTimeout(timer)
            stopHeartbeat()

            const socket = ws
            ws = null
            if (!socket) return

            socket.onmessage = null
            socket.onerror = null
            socket.onclose = null

            if (socket.readyState === WebSocket.CONNECTING) {
                socket.onopen = () => socket.close()
            } else {
                socket.onopen = null
                try { socket.close() } catch { /* ignore */ }
            }
        },
    }
}