import { getToken } from '../lib/auth'

const MAX_FAILED_ATTEMPTS = 5
// backend rad etgan kodlar: 4001 — auth yo'q, 4003 — ruxsat yo'q (qayta urinish foydasiz)
const NO_RETRY_CODES = [4001, 4003]

const buildUrl = (url) => {
    const token = getToken()
    if (!token) return url
    const sep = url.includes('?') ? '&' : '?'
    return `${url}${sep}token=${encodeURIComponent(token)}`
}

export function createSupportSocket({ url, onEvent, onStatus }) {
    if (!url) {
        onStatus?.('disabled')
        return { send() { }, close() { } }
    }

    let ws = null
    let closed = false
    let retry = 0
    let failures = 0
    let timer = null

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
            onStatus?.('connected')
        }

        socket.onmessage = (event) => {
            try {
                onEvent?.(JSON.parse(event.data))
            } catch (error) {
                console.warn('[supportSocket] Invalid message:', error)
            }
        }

        socket.onclose = (event) => {
            if (ws !== socket) return
            if (NO_RETRY_CODES.includes(event.code)) {
                console.warn('[supportSocket] Backend rad etdi, code =', event.code)
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