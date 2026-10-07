/**
 * Support chat uchun real-vaqt WebSocket ulanishi.
 *
 * ---- Server -> Client ----
 * { type: 'message', chatId, message: { id, from, text, ts, sender_name } }
 * { type: 'chat',    chat }
 * { type: 'typing',  chatId, typing: boolean }
 * { type: 'ack',     chatId, messageId, status: 'delivered'|'read' }
 * { type: 'status',  chatId, status, assignee }
 *
 * ---- Client -> Server ----
 * { type: 'message', chatId, id, text }
 * { type: 'status',  chatId, status }
 * { type: 'read',    chatId }
 */

const getToken = () =>
    localStorage.getItem('access_token') || localStorage.getItem('token') || ''

export function createSupportSocket({ url, onEvent, onStatus }) {
    if (!url) {
        console.warn(
            '[supportSocket] VITE_SUPPORT_WS_URL berilmagan — real-time oʻchirilgan',
        )
        onStatus?.('disabled')
        return { send() { }, close() { } }
    }

    const token = getToken()
    const fullUrl = token
        ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
        : url

    let ws
    let closed = false
    let retry = 0
    let timer

    const connect = () => {
        if (closed) return
        onStatus?.(retry ? 'reconnecting' : 'connecting')

        try {
            ws = new WebSocket(fullUrl)
        } catch (err) {
            console.error('[supportSocket] WebSocket yaratilmadi:', err)
            onStatus?.('error')
            return
        }

        ws.onopen = () => {
            retry = 0
            onStatus?.('connected')
        }

        ws.onmessage = (e) => {
            try {
                onEvent?.(JSON.parse(e.data))
            } catch (err) {
                console.warn('[supportSocket] notoʻgʻri JSON:', e.data, err)
            }
        }

        ws.onclose = () => {
            if (closed) return
            onStatus?.('reconnecting')
            retry += 1
            const delay = Math.min(1000 * 2 ** retry, 15000)
            timer = setTimeout(connect, delay)
        }

        ws.onerror = () => {
            try { ws.close() } catch { /* ignore */ }
        }
    }

    connect()

    return {
        send(payload) {
            if (ws?.readyState === WebSocket.OPEN) {
                try {
                    ws.send(JSON.stringify(payload))
                } catch (err) {
                    console.warn('[supportSocket] send error:', err)
                }
            }
        },
        close() {
            closed = true
            clearTimeout(timer)
            try { ws?.close() } catch { /* ignore */ }
        },
    }
}