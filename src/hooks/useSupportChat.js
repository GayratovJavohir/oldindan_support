import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createSupportSocket } from '../services/supportSocket'
import { SUPPORT_API, buildConversationWsUrl, buildInboxWsUrl } from '../config/env'
import { getAgentName, getUserId, setAgentName } from '../lib/auth'
import { http, readJson, refreshAccess } from '../lib/http'

/*
 * Backend (support app):
 *   REST  /api/support/conversations/                     (sahifalangan: page, page_size)
 *         /api/support/conversations/<id>/messages/       (cursor, eng yangisi birinchi)
 *         /api/support/conversations/<id>/messages/send/  {text, internal, booking_id}
 *         /api/support/conversations/<id>/{close,reopen,claim,transfer}/
 *         /api/support/conversations/<id>/bookings/
 *         /api/support/agents/
 *   WS    /ws/support/inbox/        -> inbox_update, assigned_to_you
 *         /ws/support/<id>/         -> message, conversation, read, error, pong
 *
 * UI holati: closed -> 'resolved'; open + mas'ulsiz -> 'new'; open + mas'ul bor -> 'open'.
 */

const POLL_LIST_MS = 5000 // WS yo'q bo'lsa ro'yxat yangilanishi (WS bor bo'lsa — kamdan-kam)
const POLL_MESSAGES_MS = 4000 // faqat suhbat WS'i ulanmagan bo'lsa
const LIST_PAGE_SIZE = 100
const LIST_MAX_PAGES = 5
const NOTICE_MS = 5000

const toId = (v) => (v == null ? null : String(v))
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

function toTs(v) {
  if (!v) return 0
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
  const n = new Date(v).getTime()
  return Number.isFinite(n) ? n : 0
}

// DRF xato javobidan (ichma-ich ham) o'qiladigan matn
function errorText(data, fallback) {
  const out = []
  const walk = (v) => {
    if (v == null) return
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (isObj(v)) Object.values(v).forEach(walk)
  }
  walk(data)
  return out.length ? out.join(' ') : fallback
}

function listOf(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.results)) return data.results
  return []
}

// CursorPagination `next` URL'idan faqat cursor qiymatini olamiz (host proxy orqali o'zgargan bo'lishi mumkin)
function cursorOf(nextUrl) {
  if (!nextUrl) return null
  try {
    return new URL(nextUrl, window.location.origin).searchParams.get('cursor')
  } catch {
    return null
  }
}

// ---------- normalizers ----------

const KIND_FROM = { user: 'user', agent: 'agent', internal: 'agent', system: 'system' }

function formatMessage(m) {
  const id = toId(m?.id)
  if (!id) return null
  const kind = m.kind || 'agent'
  return {
    id,
    kind,
    from: KIND_FROM[kind] || 'agent',
    internal: kind === 'internal',
    senderName: m.sender_name || null,
    text: m.content ?? '',
    ts: toTs(m.created_at) || Date.now(),
    // agent xabari uchun is_read = user o'qigan
    status: m.is_read ? 'read' : 'sent',
    booking: m.booking != null ? { id: toId(m.booking), branch: m.branch_name || null } : null,
  }
}

function formatChat(c) {
  const id = toId(c?.id)
  if (!id) return null

  const u = isObj(c.user) ? c.user : {}
  const a = isObj(c.assigned_to) ? c.assigned_to : null
  const assigneeId = a ? toId(a.id) : null
  const lm = isObj(c.last_message) ? c.last_message : null

  return {
    id,
    user: {
      id: toId(u.id),
      name: u.full_name || u.phone || u.email || `Suhbat #${id}`,
      phone: u.phone || null,
      email: u.email || null,
      role: u.role || null,
    },
    status: c.status === 'closed' ? 'resolved' : assigneeId ? 'open' : 'new',
    assignee: a ? a.full_name || `Xodim #${assigneeId}` : null,
    assigneeId,
    closedBy: isObj(c.closed_by) ? c.closed_by.full_name || null : null,
    closedAt: c.closed_at || null,
    createdAt: c.created_at || null,
    unread: c.unread_count ?? 0,
    lastTs: toTs(c.last_message_at) || toTs(c.updated_at) || toTs(c.created_at),
    preview: lm
      ? {
        from: KIND_FROM[lm.kind] || 'agent',
        internal: lm.kind === 'internal',
        text: lm.content || '',
        ts: toTs(lm.created_at),
      }
      : null,
  }
}

// ---------- reducer ----------

const init = () => ({ chats: [], activeId: null, loading: true })

const patchChat = (state, id, fn) => ({
  ...state,
  chats: state.chats.map((c) => (c.id === id ? fn(c) : c)),
})

const cmp = (a, b) => a.ts - b.ts || (Number(a.id) || 0) - (Number(b.id) || 0)
const isTmp = (m) => String(m.id).startsWith('tmp_')

// serverdagi xabarlar + oldin yuklanganlar + hali yuborilayotgan lokal xabarlar
function combine(current, server) {
  const byId = new Map(current.filter((m) => !isTmp(m)).map((m) => [m.id, m]))
  for (const m of server) byId.set(m.id, m)
  const tmps = current.filter(
    (m) =>
      isTmp(m) &&
      !server.some(
        (s) =>
          s.from === 'agent' &&
          s.internal === m.internal &&
          s.text === m.text &&
          Math.abs(s.ts - m.ts) < 120000,
      ),
  )
  return [...byId.values(), ...tmps].sort(cmp)
}

function mergeSummary(state, inc) {
  const unread = state.activeId === inc.id ? 0 : inc.unread
  const ex = state.chats.find((c) => c.id === inc.id)
  if (!ex) {
    return {
      ...state,
      chats: [
        { ...inc, unread, messages: [], loaded: false, nextCursor: null, bookings: null },
        ...state.chats,
      ],
    }
  }
  return patchChat(state, inc.id, (c) => ({ ...c, ...inc, unread }))
}

function reducer(state, act) {
  switch (act.type) {
    // ro'yxat (birinchi yuklash va polling): mavjud xabarlarni saqlab qoladi
    case 'chats': {
      let s = state
      for (const c of act.chats) s = mergeSummary(s, c)
      return { ...s, loading: false }
    }

    // WS (inbox_update / conversation) va amal javoblari
    case 'summary':
      return mergeSummary(state, act.chat)

    case 'set_messages':
      return patchChat(state, act.chatId, (c) => ({
        ...c,
        loaded: true,
        messages: combine(c.messages || [], act.messages),
        // keyingi (eski) sahifa kursori faqat birinchi yuklashda olinadi
        nextCursor: c.loaded ? c.nextCursor : act.nextCursor,
      }))

    case 'prepend_messages':
      return patchChat(state, act.chatId, (c) => ({
        ...c,
        messages: combine(c.messages || [], act.messages),
        nextCursor: act.nextCursor,
        loadingOlder: false,
      }))

    case 'select':
      return {
        ...patchChat(state, act.id, (c) => ({ ...c, unread: 0 })),
        activeId: act.id,
      }

    // suhbat WS'idan yangi xabar
    case 'incoming':
      return patchChat(state, act.chatId, (c) => {
        const list = c.messages || []
        if (list.some((m) => m.id === act.message.id)) return c
        return { ...c, messages: combine(list, [act.message]) }
      })

    // user agent xabarlarini o'qidi
    case 'read_by_user':
      return patchChat(state, act.chatId, (c) => ({
        ...c,
        messages: (c.messages || []).map((m) =>
          m.kind === 'agent' && m.status !== 'read' ? { ...m, status: 'read' } : m,
        ),
      }))

    case 'send':
      return patchChat(state, act.chatId, (c) => ({
        ...c,
        messages: [...(c.messages || []), act.message],
      }))

    case 'replace':
      return patchChat(state, act.chatId, (c) => {
        const list = c.messages || []
        // WS real xabarni allaqachon olib kelgan bo'lsa — vaqtinchalikni olib tashlaymiz
        if (list.some((m) => m.id === act.message.id)) {
          return { ...c, messages: list.filter((m) => m.id !== act.tempId) }
        }
        return {
          ...c,
          messages: list.map((m) => (m.id === act.tempId ? act.message : m)).sort(cmp),
        }
      })

    case 'ack':
      return patchChat(state, act.chatId, (c) => ({
        ...c,
        messages: (c.messages || []).map((m) =>
          m.id === act.messageId ? { ...m, status: act.status } : m,
        ),
      }))

    case 'remove_message':
      return patchChat(state, act.chatId, (c) => ({
        ...c,
        messages: (c.messages || []).filter((m) => m.id !== act.messageId),
      }))

    case 'patch':
      return patchChat(state, act.chatId, (c) => ({ ...c, ...act.patch }))

    default:
      return state
  }
}

// ---------- API ----------

const api = (path, options) => http(`${SUPPORT_API}${path}`, options)

async function fetchConversations(signal, all) {
  const out = []
  for (let page = 1; page <= (all ? LIST_MAX_PAGES : 1); page += 1) {
    const res = await api(`/conversations/?page_size=${LIST_PAGE_SIZE}&page=${page}`, { signal })
    if (!res.ok) throw new Error(`conversations (${res.status})`)
    const data = await readJson(res)
    out.push(...listOf(data).map(formatChat).filter(Boolean))
    if (!data?.next) break
  }
  return out
}

// birinchi sahifa (cursor yo'q) — backend uni "o'qildi" deb belgilaydi
async function fetchMessages(chatId, { cursor, signal } = {}) {
  const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
  const res = await api(`/conversations/${chatId}/messages/${qs}`, { signal })
  if (!res.ok) throw new Error(`Xabarlarni olib bo'lmadi (${res.status})`)
  const data = await readJson(res)
  return {
    messages: listOf(data).map(formatMessage).filter(Boolean),
    nextCursor: cursorOf(data?.next),
  }
}

// ---------- hook ----------

export default function useSupportChat() {
  const [state, dispatch] = useReducer(reducer, null, init)
  const [inboxState, setInboxState] = useState('connecting')
  const [convState, setConvState] = useState('connecting')
  const [pollState, setPollState] = useState('idle') // idle | ok | error
  const [notice, setNotice] = useState(null)
  const [agents, setAgents] = useState({ list: [], loading: false, error: null })

  const chatsRef = useRef([])
  const inboxRef = useRef('connecting')
  const convRef = useRef('connecting')
  const socketRef = useRef(null)
  const noticeTimer = useRef(null)
  const reloadRef = useRef(() => { })

  useEffect(() => {
    chatsRef.current = state.chats
  }, [state.chats])

  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  const notify = useCallback((text) => {
    clearTimeout(noticeTimer.current)
    setNotice(text)
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_MS)
  }, [])

  const dismissNotice = useCallback(() => {
    clearTimeout(noticeTimer.current)
    setNotice(null)
  }, [])

  // 1. Suhbatlar ro'yxati: birinchi yuklash (hamma sahifa) + polling zaxirasi
  useEffect(() => {
    let alive = true
    let initial = true
    let busy = false
    let skipped = 0
    const controller = new AbortController()

    async function tick() {
      if (busy) return
      // inbox WS ulangan bo'lsa — faqat har ~minutda bir marta tekshiramiz
      if (!initial && inboxRef.current === 'connected' && (skipped += 1) % 12 !== 0) return
      busy = true
      try {
        const chats = await fetchConversations(controller.signal, initial)
        if (!alive) return

        // o'zimizning ismimiz: bizga biriktirilgan suhbatdan olamiz
        const me = getUserId()
        const mine = me && chats.find((c) => c.assigneeId === me && c.assignee)
        if (mine) setAgentName(mine.assignee)

        dispatch({ type: 'chats', chats })
        initial = false
        setPollState('ok')
      } catch (err) {
        if (err.name === 'AbortError') return
        console.error('Conversations fetch error:', err)
        if (alive) {
          setPollState('error')
          if (initial) {
            dispatch({ type: 'chats', chats: [] })
            initial = false
          }
        }
      } finally {
        busy = false
      }
    }

    reloadRef.current = () => {
      skipped = 0
      initial = true
      return tick()
    }
    tick()
    const timer = setInterval(tick, POLL_LIST_MS)
    return () => {
      alive = false
      clearInterval(timer)
      controller.abort()
    }
  }, [])

  // 2. Inbox WS: yangi xabar/suhbat, status va mas'ul o'zgarishi
  useEffect(() => {
    const socket = createSupportSocket({
      url: buildInboxWsUrl(),
      onUnauthorized: refreshAccess,
      onStatus: (s) => {
        inboxRef.current = s
        setInboxState(s)
      },
      onEvent: (e) => {
        if (e?.event !== 'inbox_update' && e?.event !== 'assigned_to_you') return
        const chat = formatChat(e.conversation)
        if (!chat) return
        dispatch({ type: 'summary', chat })
        if (e.event === 'assigned_to_you') notify(`Sizga suhbat biriktirildi: ${chat.user.name}`)
      },
    })
    return () => socket.close()
  }, [notify])

  // 3. Ochiq suhbat WS'i: /ws/support/<conversation_id>/
  const activeId = state.activeId

  useEffect(() => {
    if (!activeId) return

    const socket = createSupportSocket({
      url: buildConversationWsUrl(activeId),
      onUnauthorized: refreshAccess,
      onStatus: (s) => {
        convRef.current = s
        setConvState(s)
      },
      onEvent: (e) => {
        switch (e?.event) {
          case 'message': {
            const m = formatMessage(e.message)
            if (!m) break
            dispatch({ type: 'incoming', chatId: activeId, message: m })
            // suhbat ochiq turibdi — user xabari darhol o'qilgan hisoblanadi
            if (m.from === 'user') socket.send({ action: 'read' })
            break
          }
          case 'conversation': {
            const chat = formatChat(e.conversation)
            if (chat) dispatch({ type: 'summary', chat })
            break
          }
          case 'read':
            if (e.by === 'user') dispatch({ type: 'read_by_user', chatId: activeId })
            break
          case 'error':
            notify(errorText(e.detail, 'Xatolik yuz berdi.'))
            break
          default:
            break
        }
      },
    })
    socketRef.current = socket

    return () => {
      socket.close()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [activeId, notify])

  const wsStatus = activeId ? convState : 'disabled'

  // 4. Xabarlarni yuklash (tanlaganda, amaldan keyin va WS'siz polling uchun)
  const syncMessages = useCallback(async (chatId, signal) => {
    const { messages, nextCursor } = await fetchMessages(chatId, { signal })
    dispatch({ type: 'set_messages', chatId, messages, nextCursor })
  }, [])

  // WS ulanmagan bo'lsa ochiq suhbatni polling bilan yangilab turamiz
  useEffect(() => {
    if (!activeId) return
    if (!['disabled', 'reconnecting', 'error'].includes(wsStatus)) return

    let alive = true
    let busy = false
    const controller = new AbortController()

    async function tick() {
      if (busy) return
      busy = true
      try {
        await syncMessages(activeId, controller.signal)
      } catch (err) {
        if (alive && err.name !== 'AbortError') console.error('Messages poll error:', err)
      } finally {
        busy = false
      }
    }

    const timer = setInterval(tick, POLL_MESSAGES_MS)
    return () => {
      alive = false
      clearInterval(timer)
      controller.abort()
    }
  }, [activeId, wsStatus, syncMessages])

  const select = useCallback(
    async (rawId) => {
      const id = toId(rawId)
      if (!id) return
      dispatch({ type: 'select', id })
      try {
        await syncMessages(id)
      } catch (err) {
        console.error('Messages fetch error:', err)
        notify('Xabarlarni yuklab bo‘lmadi.')
      }
    },
    [syncMessages, notify],
  )

  const loadOlder = useCallback(
    async (rawId) => {
      const chatId = toId(rawId)
      const chat = chatsRef.current.find((c) => c.id === chatId)
      if (!chat?.nextCursor || chat.loadingOlder) return

      dispatch({ type: 'patch', chatId, patch: { loadingOlder: true } })
      try {
        const { messages, nextCursor } = await fetchMessages(chatId, { cursor: chat.nextCursor })
        dispatch({ type: 'prepend_messages', chatId, messages, nextCursor })
      } catch (err) {
        console.error('Older messages error:', err)
        dispatch({ type: 'patch', chatId, patch: { loadingOlder: false } })
        notify('Eski xabarlarni yuklab bo‘lmadi.')
      }
    },
    [notify],
  )

  // 5. Xabar yuborish (REST; WS orqali kelgan nusxa id bo'yicha birlashtiriladi)
  const sendMessage = useCallback(
    async (rawChatId, rawText, { internal = false } = {}) => {
      const chatId = toId(rawChatId)
      const text = (rawText ?? '').trim()
      if (!chatId || !text) return

      const chat = chatsRef.current.find((c) => c.id === chatId)
      if (!chat) return

      const agentName = getAgentName()
      const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

      dispatch({
        type: 'send',
        chatId,
        message: {
          id: tempId,
          kind: internal ? 'internal' : 'agent',
          from: 'agent',
          internal,
          senderName: agentName,
          text,
          ts: Date.now(),
          status: 'sending',
          booking: null,
        },
      })

      try {
        const res = await api(`/conversations/${chatId}/messages/send/`, {
          method: 'POST',
          body: JSON.stringify({ text, internal }),
        })
        const data = await readJson(res)
        if (!res.ok) throw new Error(errorText(data, `Xabar yuborilmadi (${res.status})`))

        const real = formatMessage(data)
        if (real) {
          dispatch({
            type: 'replace',
            chatId,
            tempId,
            message: { ...real, senderName: real.senderName || agentName },
          })
        } else {
          dispatch({ type: 'ack', chatId, messageId: tempId, status: 'sent' })
        }
      } catch (err) {
        console.error('Send message error:', err)
        dispatch({ type: 'ack', chatId, messageId: tempId, status: 'failed' })
        notify(err.message || 'Xabar yuborilmadi. «Qayta yuborish» tugmasini bosing.')
      }
    },
    [notify],
  )

  const retryMessage = useCallback(
    (rawChatId, messageId) => {
      const chatId = toId(rawChatId)
      const chat = chatsRef.current.find((c) => c.id === chatId)
      const msg = chat?.messages?.find((m) => m.id === messageId)
      if (!msg || msg.status !== 'failed') return
      dispatch({ type: 'remove_message', chatId, messageId })
      sendMessage(chatId, msg.text, { internal: msg.internal })
    },
    [sendMessage],
  )

  // 6. Holat amallari: claim | close | reopen | transfer. Javob — yangilangan suhbat.
  const act = useCallback(
    async (rawChatId, action, body) => {
      const chatId = toId(rawChatId)
      const chat = chatsRef.current.find((c) => c.id === chatId)
      if (!chat || chat.statusBusy) return false

      dispatch({ type: 'patch', chatId, patch: { statusBusy: true } })
      try {
        const res = await api(`/conversations/${chatId}/${action}/`, {
          method: 'POST',
          body: JSON.stringify(body || {}),
        })
        const data = await readJson(res)
        if (!res.ok) throw new Error(errorText(data, `Amal bajarilmadi (${res.status})`))

        const updated = formatChat(data)
        if (updated) {
          dispatch({ type: 'summary', chat: updated })
          if (updated.assigneeId === getUserId() && updated.assignee) setAgentName(updated.assignee)
        }
        // tizim xabarlari ("Suhbat yopildi", ...) WS orqali keladi; WS yo'q bo'lsa — qayta yuklaymiz
        if (convRef.current !== 'connected') syncMessages(chatId).catch(() => { })
        return true
      } catch (err) {
        console.error(`Conversation ${action} error:`, err)
        notify(err.message || 'Amalni bajarib bo‘lmadi. Qayta urinib ko‘ring.')
        return false
      } finally {
        dispatch({ type: 'patch', chatId, patch: { statusBusy: false } })
      }
    },
    [notify, syncMessages],
  )

  const claim = useCallback((id) => act(id, 'claim'), [act])
  const closeChat = useCallback((id) => act(id, 'close'), [act])
  const reopen = useCallback((id) => act(id, 'reopen'), [act])
  const transfer = useCallback(
    (id, toAgentId, note = '') => act(id, 'transfer', { to_agent_id: Number(toAgentId), note }),
    [act],
  )

  // 7. O'tkazish uchun xodimlar (o'zi chiqmaydi)
  const loadAgents = useCallback(async () => {
    setAgents((a) => ({ ...a, loading: true, error: null }))
    try {
      const res = await api('/agents/')
      const data = await readJson(res)
      if (!res.ok) throw new Error(errorText(data, `Xodimlar (${res.status})`))
      setAgents({ list: Array.isArray(data) ? data : listOf(data), loading: false, error: null })
    } catch (err) {
      console.error('Agents fetch error:', err)
      setAgents((a) => ({ ...a, loading: false, error: 'Xodimlar ro‘yxatini olib bo‘lmadi.' }))
    }
  }, [])

  // 8. User'ning oxirgi bookinglari (check-in kodsiz)
  const loadBookings = useCallback(async (rawId) => {
    const chatId = toId(rawId)
    if (!chatId) return
    try {
      const res = await api(`/conversations/${chatId}/bookings/`)
      const data = await readJson(res)
      if (!res.ok) throw new Error(errorText(data, `Bronlar (${res.status})`))
      dispatch({
        type: 'patch',
        chatId,
        patch: { bookings: Array.isArray(data) ? data : listOf(data), bookingsError: null },
      })
    } catch (err) {
      console.error('Bookings fetch error:', err)
      dispatch({
        type: 'patch',
        chatId,
        patch: { bookings: [], bookingsError: 'Bronlarni olib bo‘lmadi.' },
      })
    }
  }, [])

  const reload = useCallback(() => reloadRef.current(), [])

  const active = useMemo(
    () => state.chats.find((c) => c.id === state.activeId) ?? null,
    [state.chats, state.activeId],
  )

  // connected — inbox WS ulangan (real-time); polling — faqat REST; offline — server javob bermayapti
  const connection =
    inboxState === 'connected'
      ? 'connected'
      : pollState === 'ok'
        ? 'polling'
        : pollState === 'error'
          ? 'offline'
          : 'connecting'

  return {
    chats: state.chats,
    active,
    loading: state.loading,
    error: pollState === 'error' ? 'Ma’lumotlarni yuklab bo‘lmadi' : null,
    notice,
    connection,
    agents,
    select,
    sendMessage,
    retryMessage,
    claim,
    closeChat,
    reopen,
    transfer,
    loadOlder,
    loadAgents,
    loadBookings,
    reload,
    dismissNotice,
  }
}