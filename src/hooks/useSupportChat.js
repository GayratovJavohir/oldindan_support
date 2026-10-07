import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createSupportSocket } from '../services/supportSocket'

const API_BASE = '/api/support'
const CURRENT_AGENT = { name: 'Dilshod', role: 'Support xodimi' }

const POLL_LIST_MS = 5000 // ticketlar ro'yxati
const POLL_MESSAGES_MS = 2500 // ochiq chatdagi xabarlar

const init = () => ({ chats: [], activeId: null, loading: true })

const toId = (v) => (v == null ? null : String(v))

const first = (...vals) =>
  vals.find((v) => v !== undefined && v !== null && v !== '') ?? null

const patchChat = (state, id, fn) => ({
  ...state,
  chats: state.chats.map((c) => (c.id === id ? fn(c) : c)),
})

// ---------- reducer ----------

function reducer(state, act) {
  switch (act.type) {
    case 'set_initial_chats':
      return {
        ...state,
        chats: act.chats.map((c) => ({ ...c, unread: c.unread ?? 0 })),
        loading: false,
      }

    // polling: ro'yxatni yangilaydi, ochilgan xabarlarni saqlab qoladi
    case 'merge_chats': {
      const old = new Map(state.chats.map((c) => [c.id, c]))
      const merged = act.chats.map((inc) => {
        const ex = old.get(inc.id)
        if (!ex) return { ...inc, unread: inc.unread ?? 0 }
        return {
          ...ex,
          ...inc,
          messages: ex.loaded ? ex.messages : inc.messages,
          loaded: ex.loaded,
          typing: ex.typing,
          unread: state.activeId === inc.id ? 0 : inc.unread ?? ex.unread ?? 0,
        }
      })
      // ro'yxatda yo'q, lekin lokal (WS orqali kelgan) chatlarni yo'qotmaymiz
      const ids = new Set(merged.map((c) => c.id))
      const extra = state.chats.filter((c) => !ids.has(c.id))
      return { ...state, chats: [...merged, ...extra], loading: false }
    }

    case 'set_messages':
      return patchChat(state, act.chatId, (c) => ({
        ...c,
        loaded: true,
        messages: act.messages,
      }))

    // polling: serverdagi xabarlar + hali yuborilayotgan lokal xabarlar
    case 'merge_messages': {
      const chat = state.chats.find((c) => c.id === act.chatId)
      if (!chat) return state

      const server = act.messages
      const ids = new Set(server.map((m) => m.id))
      const current = chat.messages || []

      const pending = current.filter((m) => {
        const id = String(m.id)
        if (id.startsWith('sys_')) return true
        if (!id.startsWith('tmp_')) return false
        if (ids.has(m.id)) return false
        return !server.some(
          (s) => s.from === 'agent' && s.text === m.text && Math.abs(s.ts - m.ts) < 120000,
        )
      })

      const next = [...server, ...pending].sort((a, b) => a.ts - b.ts)
      const same =
        chat.loaded &&
        next.length === current.length &&
        next.every(
          (m, i) =>
            m.id === current[i].id &&
            m.status === current[i].status &&
            m.text === current[i].text,
        )
      if (same) return state

      return patchChat(state, act.chatId, (c) => ({
        ...c,
        loaded: true,
        messages: next,
      }))
    }

    case 'select':
      return {
        ...patchChat(state, act.id, (c) => ({ ...c, unread: 0 })),
        activeId: act.id,
      }

    case 'incoming': {
      const msg = act.message
      if (!msg) return state
      const fromAgent = msg.from === 'agent'

      return patchChat(state, act.chatId, (c) => {
        if (msg.id && (c.messages || []).some((m) => m.id === msg.id)) return c

        return {
          ...c,
          typing: false,
          unread: fromAgent
            ? c.unread || 0
            : state.activeId === c.id
              ? 0
              : (c.unread || 0) + 1,
          status: !fromAgent && c.status === 'resolved' ? 'new' : c.status,
          messages: [...(c.messages || []), msg],
        }
      })
    }

    case 'newChat':
      return state.chats.some((c) => c.id === act.chat.id)
        ? state
        : { ...state, chats: [act.chat, ...state.chats] }

    case 'typing':
      return patchChat(state, act.chatId, (c) => ({ ...c, typing: act.typing }))

    case 'send':
      return patchChat(state, act.chatId, (c) => ({
        ...c,
        status: c.status === 'new' ? 'open' : c.status,
        assignee: c.assignee ?? CURRENT_AGENT.name,
        messages: [...(c.messages || []), act.message],
      }))

    case 'replace':
      return patchChat(state, act.chatId, (c) => {
        const list = c.messages || []
        // polling real xabarni allaqachon olib kelgan bo'lsa — vaqtinchalikni olib tashlaymiz
        if (list.some((m) => m.id === act.message.id)) {
          return { ...c, messages: list.filter((m) => m.id !== act.tempId) }
        }
        return {
          ...c,
          messages: list.map((m) =>
            m.id === act.tempId
              ? { ...act.message, status: act.message.status || 'delivered' }
              : m,
          ),
        }
      })

    case 'ack':
      return patchChat(state, act.chatId, (c) => ({
        ...c,
        messages: (c.messages || []).map((m) =>
          m.id === act.messageId ? { ...m, status: act.status } : m,
        ),
      }))

    case 'status':
      return patchChat(state, act.chatId, (c) => ({
        ...c,
        status: act.status,
        assignee: act.assignee ?? c.assignee ?? CURRENT_AGENT.name,
        messages: act.silent
          ? c.messages || []
          : [
            ...(c.messages || []),
            {
              id: `sys_${Date.now()}`,
              from: 'system',
              ts: Date.now(),
              text:
                act.status === 'resolved'
                  ? `Murojaat hal qilindi — ${act.assignee || CURRENT_AGENT.name}`
                  : c.status === 'resolved'
                    ? `Murojaat qayta ochildi — ${act.assignee || CURRENT_AGENT.name}`
                    : `Murojaatni ${act.assignee || CURRENT_AGENT.name} qabul qildi`,
            },
          ],
      }))

    default:
      return state
  }
}

// ---------- API helpers ----------

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token')
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  })
  if (res.status === 401) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    window.dispatchEvent(new Event('support:unauthorized'))
  }
  return res
}

async function readJson(res) {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function normalizeList(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  for (const key of ['results', 'data', 'messages', 'items', 'tickets']) {
    if (Array.isArray(data[key])) return data[key]
  }
  if (data.data && typeof data.data === 'object') return normalizeList(data.data)
  return []
}

// ---------- normalizers ----------

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

function normalizeAssignee(a) {
  if (!a) return null
  if (typeof a === 'string') return a
  if (isObj(a)) {
    return (
      first(
        a.full_name,
        [a.first_name, a.last_name].filter(Boolean).join(' '),
        a.name,
        a.username,
        a.email,
      ) || null
    )
  }
  return null
}

function normalizeStatus(s) {
  const v = String(s || 'new').toLowerCase()
  if (['resolved', 'closed', 'done', 'solved'].includes(v)) return 'resolved'
  if (['open', 'opened', 'assigned', 'in_progress', 'processing'].includes(v)) return 'open'
  if (['new', 'pending', 'created', 'waiting'].includes(v)) return 'new'
  return v
}

function personName(o) {
  if (!isObj(o)) return null
  return (
    first(
      o.full_name,
      [o.first_name, o.last_name].filter(Boolean).join(' ') || null,
      o.name,
      o.business_name,
      o.company_name,
      o.store_name,
      o.shop_name,
      o.username,
      o.email,
    ) || null
  )
}

function fmtDate(v) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return d.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'short', day: 'numeric' })
}

function toTs(v) {
  if (!v) return 0
  if (typeof v === 'number') return v < 1e12 ? v * 1000 : v
  const n = new Date(v).getTime()
  return Number.isFinite(n) ? n : 0
}

function resolveAudience(t, fallback) {
  const raw = first(
    t.audience,
    t.audience_type,
    t.ticket_type,
    t.user_type,
    t.source,
    t.kind,
    t.target,
  )
  if (typeof raw === 'string') {
    const v = raw.toLowerCase()
    if (v.includes('partner')) return 'partner'
    if (v.includes('consumer') || v.includes('customer') || v.includes('client')) return 'consumer'
  }
  return fallback
}

function formatChat(t, fallbackAudience = 'consumer') {
  if (!t) return null

  const ticketId = toId(first(t.id, t.pk, t.ticket_id))
  if (!ticketId) return null

  const audience = resolveAudience(t, fallbackAudience)
  const id = `${audience}:${ticketId}`

  // user ma'lumotlari turli joyda bo'lishi mumkin: ichki obyekt yoki tekis maydonlar
  const u =
    [t.user, t.consumer, t.partner, t.customer, t.client, t.created_by, t.owner, t.author].find(
      isObj,
    ) || {}
  const p = isObj(u.profile) ? u.profile : {}

  const userName =
    first(
      t.user_name,
      t.consumer_name,
      t.partner_name,
      t.customer_name,
      t.client_name,
      personName(u),
      t.email,
    ) || `Murojaat #${ticketId}`

  const rawUserId = first(
    u.id,
    t.user_id,
    t.consumer_id,
    t.partner_id,
    t.customer_id,
    !isObj(t.user) ? t.user : null,
    !isObj(t.consumer) ? t.consumer : null,
    !isObj(t.partner) ? t.partner : null,
  )

  const chatBase = { user: { name: userName }, userId: toId(rawUserId) }

  const messages = Array.isArray(t.messages)
    ? t.messages.map((m) => formatMessage(m, chatBase)).filter(Boolean)
    : []

  // ro'yxatda faqat oxirgi xabar kelsa — preview uchun ishlatamiz
  if (!messages.length && t.last_message) {
    const lm = isObj(t.last_message) ? t.last_message : { text: String(t.last_message) }
    const m = formatMessage(
      { created_at: t.last_message_at || t.updated_at, ...lm },
      chatBase,
    )
    if (m) messages.push(m)
  }

  return {
    ...t,
    id,
    ticketId,
    audience,
    userId: toId(rawUserId),
    user: {
      name: userName,
      phone:
        first(
          t.user_phone,
          t.consumer_phone,
          t.partner_phone,
          t.phone,
          t.phone_number,
          u.phone,
          u.phone_number,
          u.mobile,
          p.phone,
        ) || '—',
      email: first(t.user_email, u.email, t.email) || '—',
      orders:
        first(
          t.user_orders,
          t.orders_count,
          t.total_orders,
          u.orders_count,
          u.total_orders,
          u.orders,
        ) ?? 0,
      joined:
        fmtDate(
          first(t.user_joined, u.date_joined, u.created_at, u.joined_at, p.created_at),
        ) || '—',
      city:
        first(
          t.user_city,
          t.city,
          u.city,
          u.region,
          p.city,
          isObj(u.address) ? u.address.city : null,
        ) || '—',
      lang: first(t.user_lang, t.language, u.language, u.lang, p.language) || '—',
      device: first(t.user_device, t.device, t.device_model, u.device, u.device_model) || '—',
      os: first(t.user_os, t.os, t.platform, u.os, u.platform) || '—',
      appVersion:
        first(t.user_app_version, t.app_version, u.app_version, u.version) || '—',
    },
    status: normalizeStatus(t.status),
    assignee: normalizeAssignee(t.assignee) || normalizeAssignee(t.assigned_to),
    unread: first(t.unread_count, t.unread) ?? undefined,
    tags: Array.isArray(t.tags) ? t.tags : [],
    lastTs: toTs(first(t.last_message_at, t.updated_at, t.created_at)),
    messages,
    loaded: false,
  }
}

const USER_ROLES = ['user', 'consumer', 'partner', 'customer', 'client']
const AGENT_ROLES = ['agent', 'admin', 'support', 'staff', 'operator', 'moderator', 'manager']

function detectFrom(m, chat) {
  const sender = isObj(m.sender) ? m.sender : null
  const role = [
    m.sender_type,
    m.sender_role,
    m.author_type,
    m.role,
    m.from,
    typeof m.sender === 'string' ? m.sender : null,
    sender?.role,
    sender?.user_type,
    sender?.type,
  ].find((v) => typeof v === 'string' && v)
  const r = role ? role.toLowerCase() : null

  if (m.is_system === true || r === 'system') return 'system'
  if (m.is_from_user === true || m.is_from_consumer === true || m.is_from_partner === true)
    return 'user'
  if (
    m.is_staff === true ||
    m.is_from_staff === true ||
    m.is_from_agent === true ||
    m.is_support === true ||
    m.is_admin === true ||
    sender?.is_staff === true
  )
    return 'agent'

  if (r) {
    if (AGENT_ROLES.some((x) => r.includes(x))) return 'agent'
    if (USER_ROLES.some((x) => r.includes(x))) return 'user'
  }

  // sender id'ni ticket egasi bilan solishtirish
  const senderId = toId(
    first(
      m.sender_id,
      m.author_id,
      m.user_id,
      sender?.id,
      typeof m.sender === 'number' ? m.sender : null,
    ),
  )
  const ownerId = toId(chat?.userId)
  if (senderId && ownerId) return senderId === ownerId ? 'user' : 'agent'

  return 'agent'
}

function formatMessage(m, chat) {
  if (!m) return null

  const from = detectFrom(m, chat)

  const senderName =
    first(
      m.sender_name,
      m.author_name,
      m.agent_name,
      m.user_name,
      personName(isObj(m.sender) ? m.sender : null),
    ) ||
    (from === 'user'
      ? chat?.user?.name || null
      : from === 'agent'
        ? normalizeAssignee(chat?.assignee) || CURRENT_AGENT.name
        : null)

  const ts = toTs(first(m.created_at, m.timestamp, m.ts, m.sent_at)) || Date.now()

  return {
    id: toId(first(m.id, m.pk, m.message_id)),
    from,
    senderName: senderName || null,
    text: first(m.text, m.content, m.message, m.body) ?? '',
    ts,
    status: m.status || (m.is_read ? 'read' : 'sent'),
  }
}

async function loadTicketList(path, audience, signal) {
  const res = await api(path, { signal })
  if (!res.ok) throw new Error(`${path} (${res.status})`)
  const data = await readJson(res)
  return normalizeList(data)
    .map((t) => formatChat(t, audience))
    // partner endpointi bo'lsa audience doim partner
    .map((c) => (c && audience === 'partner' && c.audience !== 'partner' ? formatChat(c, 'partner') : c))
    .filter(Boolean)
}

async function fetchAllTickets(signal) {
  const results = await Promise.allSettled([
    loadTicketList('/tickets/', 'consumer', signal),
    loadTicketList('/partner/tickets/', 'partner', signal),
  ])

  if (results.every((r) => r.status === 'rejected')) {
    throw results[0].reason
  }

  const map = new Map()
  for (const r of results) {
    if (r.status !== 'fulfilled') {
      if (r.reason?.name !== 'AbortError') console.warn('[tickets]', r.reason)
      continue
    }
    for (const chat of r.value) map.set(chat.id, chat)
  }
  return [...map.values()].sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0))
}

async function fetchMessages(chat, signal) {
  const res = await api(
    `/tickets/${chat.ticketId}/messages/?audience=${encodeURIComponent(chat.audience)}`,
    { signal },
  )
  if (!res.ok) {
    const body = await res.text()
    console.error('[messages] xato:', res.status, body)
    throw new Error(`Xabarlarni olib bo'lmadi (${res.status})`)
  }

  const data = await readJson(res)
  const list = normalizeList(data)
    .map((m) => formatMessage(m, chat))
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts)

  // ba'zi backendlarda birinchi murojaat matni ticketning o'zida bo'ladi
  const firstText = first(chat.description, chat.body, chat.content, chat.subject)
  if (firstText && typeof firstText === 'string' && !list.some((m) => m.text === firstText)) {
    list.unshift({
      id: `first_${chat.ticketId}`,
      from: 'user',
      senderName: chat.user?.name || null,
      text: firstText,
      ts: toTs(chat.created_at) || (list[0]?.ts ?? Date.now()) - 1,
      status: 'read',
    })
  }

  if (list.length && !window.__supportMsgLogged) {
    window.__supportMsgLogged = true
    console.debug('[support] xabar namunasi (raw):', normalizeList(data)[0])
  }

  return list
}

// ---------- hook ----------

export default function useSupportChat() {
  const [state, dispatch] = useReducer(reducer, null, init)
  const [wsStatus, setWsStatus] = useState('connecting')
  const [pollOk, setPollOk] = useState(false)
  const socketRef = useRef(null)
  const chatsRef = useRef([])
  const activeIdRef = useRef(null)

  useEffect(() => {
    chatsRef.current = state.chats
    activeIdRef.current = state.activeId
  }, [state.chats, state.activeId])

  const findChat = (rawId, audience) => {
    const id = toId(rawId)
    if (!id) return null
    return (
      chatsRef.current.find((c) => c.id === id) ||
      chatsRef.current.find(
        (c) => c.ticketId === id && (!audience || c.audience === audience),
      ) ||
      null
    )
  }

  // 1. Ticketlar: birinchi yuklash + har 5 soniyada yangilash
  useEffect(() => {
    let alive = true
    let first = true
    let busy = false
    const controller = new AbortController()

    async function tick() {
      if (busy) return
      busy = true
      try {
        const chats = await fetchAllTickets(controller.signal)
        if (!alive) return
        dispatch({ type: first ? 'set_initial_chats' : 'merge_chats', chats })
        first = false
        setPollOk(true)
      } catch (err) {
        if (err.name === 'AbortError') return
        console.error('Ticket fetch error:', err)
        if (alive) {
          setPollOk(false)
          if (first) {
            dispatch({ type: 'set_initial_chats', chats: [] })
            first = false
          }
        }
      } finally {
        busy = false
      }
    }

    tick()
    const timer = setInterval(tick, POLL_LIST_MS)
    return () => {
      alive = false
      clearInterval(timer)
      controller.abort()
    }
  }, [])

  // 2. WebSocket (bo'lsa) — tezroq yetkazish uchun
  useEffect(() => {
    const socket = createSupportSocket({
      url: import.meta.env.VITE_SUPPORT_WS_URL,
      onStatus: setWsStatus,
      onEvent: (e) => {
        if (!e || !e.type) return
        const known = findChat(e.chatId, e.audience)
        const chatId = known?.id ?? null

        switch (e.type) {
          case 'message':
            if (chatId)
              dispatch({
                type: 'incoming',
                chatId,
                message: formatMessage(e.message, known),
              })
            break

          case 'chat': {
            const chat = formatChat(e.chat, e.audience || 'consumer')
            if (chat) dispatch({ type: 'newChat', chat })
            break
          }

          case 'typing':
            if (chatId) dispatch({ type: 'typing', chatId, typing: !!e.typing })
            break

          case 'ack':
            if (chatId)
              dispatch({
                type: 'ack',
                chatId,
                messageId: toId(e.messageId),
                status: e.status,
              })
            break

          case 'status':
            if (chatId)
              dispatch({
                type: 'status',
                chatId,
                status: normalizeStatus(e.status),
                assignee: e.assignee,
                silent: true,
              })
            break

          default:
            break
        }
      },
    })

    socketRef.current = socket
    return () => {
      socketRef.current = null
      socket?.close?.()
    }
  }, [])

  // 3. Ochiq chat xabarlarini har 2.5 soniyada yangilash
  useEffect(() => {
    const id = state.activeId
    if (!id) return

    let alive = true
    let busy = false
    const controller = new AbortController()

    async function tick() {
      if (busy) return
      const chat = chatsRef.current.find((c) => c.id === id)
      if (!chat) return
      busy = true
      try {
        const messages = await fetchMessages(chat, controller.signal)
        if (alive) dispatch({ type: 'merge_messages', chatId: id, messages })
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Messages poll error:', err)
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
  }, [state.activeId])

  // 4. Chat tanlash + xabarlarni olish
  const select = useCallback(async (rawId) => {
    const id = toId(rawId)
    if (!id) return

    dispatch({ type: 'select', id })

    const chat = chatsRef.current.find((c) => c.id === id)
    if (!chat) return
    socketRef.current?.send?.({
      type: 'read',
      chatId: chat.ticketId,
      audience: chat.audience,
    })

    try {
      const messages = await fetchMessages(chat)
      dispatch({ type: 'merge_messages', chatId: id, messages })
    } catch (err) {
      console.error('Messages fetch error:', err)
    }
  }, [])

  // 5. Xabar yuborish
  const sendMessage = useCallback(async (rawChatId, rawText) => {
    const chatId = toId(rawChatId)
    const text = (rawText ?? '').trim()
    if (!chatId || !text) return

    const chat = chatsRef.current.find((c) => c.id === chatId)
    if (!chat) return

    const agentName =
      (typeof chat.assignee === 'string' ? chat.assignee : null) || CURRENT_AGENT.name
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

    dispatch({
      type: 'send',
      chatId,
      message: {
        id: tempId,
        from: 'agent',
        senderName: agentName,
        text,
        ts: Date.now(),
        status: 'sending',
      },
    })

    try {
      const res = await api(`/tickets/${chat.ticketId}/messages/send/`, {
        method: 'POST',
        body: JSON.stringify({
          text,
          content: text,
          message: text,
          audience: chat.audience,
        }),
      })

      const raw = await res.text()
      if (!res.ok) {
        console.error('[send] Django xatosi:', res.status, raw)
        throw new Error(`Xabar yuborilmadi (${res.status})`)
      }

      let saved = null
      try {
        saved = raw ? JSON.parse(raw) : null
      } catch {
        saved = null
      }

      const real = saved ? formatMessage(saved.message || saved, { ...chat, assignee: agentName }) : null
      if (real?.id) {
        // backend sender_type bermasa ham, bu xabar bizniki (agent)
        const mine = { ...real, from: 'agent', senderName: real.senderName || agentName }
        dispatch({ type: 'replace', chatId, tempId, message: mine })
        socketRef.current?.send?.({
          type: 'message',
          chatId: chat.ticketId,
          audience: chat.audience,
          id: mine.id,
          text: mine.text,
        })
        return
      }

      dispatch({ type: 'ack', chatId, messageId: tempId, status: 'delivered' })
      socketRef.current?.send?.({
        type: 'message',
        chatId: chat.ticketId,
        audience: chat.audience,
        id: tempId,
        text,
      })
    } catch (err) {
      console.error('Send message error:', err)
      dispatch({ type: 'ack', chatId, messageId: tempId, status: 'failed' })
    }
  }, [])

  // 6. Statusni o'zgartirish (assign / resolve)
  const setStatus = useCallback(async (rawChatId, newStatus) => {
    const chatId = toId(rawChatId)
    if (!chatId || !newStatus) return

    const chat = chatsRef.current.find((c) => c.id === chatId)
    if (!chat) return
    const agentName =
      (typeof chat.assignee === 'string' ? chat.assignee : null) || CURRENT_AGENT.name

    dispatch({ type: 'status', chatId, status: newStatus, assignee: agentName })
    socketRef.current?.send?.({
      type: 'status',
      chatId: chat.ticketId,
      audience: chat.audience,
      status: newStatus,
    })

    const endpoint =
      newStatus === 'resolved'
        ? `/tickets/${chat.ticketId}/resolve/`
        : `/tickets/${chat.ticketId}/assign/`

    try {
      const res = await api(endpoint, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus, audience: chat.audience }),
      })

      if (!res.ok) {
        const raw = await res.text()
        console.error('[status] Django xatosi:', res.status, raw)
        throw new Error(`Status yangilanmadi (${res.status})`)
      }
    } catch (err) {
      console.error('Status update error:', err)
    }
  }, [])

  const active = useMemo(
    () => state.chats.find((c) => c.id === state.activeId) ?? null,
    [state.chats, state.activeId],
  )

  // WS bo'lmasa ham polling ishlayotgan bo'lsa — "jonli" deb ko'rsatamiz
  const connection =
    wsStatus === 'connected' || pollOk
      ? 'connected'
      : wsStatus === 'disabled'
        ? 'reconnecting'
        : wsStatus

  return {
    chats: state.chats,
    active,
    loading: state.loading,
    connection,
    select,
    sendMessage,
    setStatus,
  }
}