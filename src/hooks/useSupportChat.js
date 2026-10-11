import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createSupportSocket } from '../services/supportSocket'
import { SUPPORT_API, buildSupportWsUrl } from '../config/env'
import { getAgentName, getUserId, setAgentName } from '../lib/auth'
import { http, readJson } from '../lib/http'

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
        const d = ex.detail ? derive(mergeSrc(inc.raw, ex.detail), inc.audience, inc.ticketId) : {}
        return {
          ...ex,
          ...inc,
          ...d,
          detail: ex.detail,
          detailKey: ex.detailKey,
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
      const metaKey = act.meta ? JSON.stringify(act.meta) : null
      const metaChanged = !!metaKey && metaKey !== chat.detailKey
      if (same && !metaChanged) return state

      return patchChat(state, act.chatId, (c) => ({
        ...c,
        ...(metaChanged
          ? {
            detail: act.meta,
            detailKey: metaKey,
            ...derive(mergeSrc(c.raw, act.meta), c.audience, c.ticketId),
          }
          : {}),
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
        messages: [...(c.messages || []), act.message],
      }))

    case 'patch':
      return patchChat(state, act.chatId, (c) => ({ ...c, ...act.patch }))

    case 'remove_message':
      return patchChat(state, act.chatId, (c) => ({
        ...c,
        messages: (c.messages || []).filter((m) => m.id !== act.messageId),
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

    // faqat server tasdiqlagandan keyin chaqiriladi
    case 'status':
      return patchChat(state, act.chatId, (c) => ({
        ...c,
        status: act.status,
        assignee: act.assignee ?? c.assignee,
        messages: [
          ...(c.messages || []),
          {
            id: `sys_${Date.now()}`,
            from: 'system',
            ts: Date.now(),
            text:
              act.status === 'resolved'
                ? `Murojaat hal qilindi — ${act.by}`
                : c.status === 'resolved'
                  ? `Murojaat qayta ochildi — ${act.by}`
                  : `Murojaatni ${act.by} qabul qildi`,
          },
        ],
      }))

    default:
      return state
  }
}

// ---------- API helpers ----------

const api = (path, options) => http(`${SUPPORT_API}${path}`, options)

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

// Backend: open | in_progress | resolved.
// Hech kim biriktirilmagan `open` ticket — "Yangi"; biriktirilgan yoki in_progress — "Jarayonda".
function normalizeStatus(s, hasAssignee = true) {
  const v = String(s || 'open').toLowerCase()
  if (['resolved', 'closed', 'done', 'solved'].includes(v)) return 'resolved'
  if (['in_progress', 'assigned', 'processing'].includes(v)) return 'open'
  if (['open', 'opened', 'new', 'pending', 'created', 'waiting'].includes(v)) {
    return hasAssignee ? 'open' : 'new'
  }
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

const p2 = (n) => String(n).padStart(2, '0')

function fmtDate(v) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`
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
  // ticketning o'zida consumer yoki partner maydoni bo'lsa — shunga qarab
  const hasC = t.consumer != null || t.consumer_id != null || !!t.consumer_name
  const hasP = t.partner != null || t.partner_id != null || !!t.partner_name
  if (hasC && !hasP) return 'consumer'
  if (hasP && !hasC) return 'partner'
  return fallback
}

// ---------- consumer / booking ma'lumotlarini backenddan terish ----------

const NESTED_USER_KEYS = [
  'user', 'consumer', 'partner', 'customer', 'client', 'created_by', 'owner',
  'author', 'requester', 'contact', 'user_info', 'user_data', 'consumer_info',
  'customer_info', 'client_info', 'profile',
]
const PREFIXES = ['user_', 'consumer_', 'customer_', 'client_', 'partner_']

const okVal = (v) => v !== undefined && v !== null && v !== '' && typeof v !== 'object'

function userScopes(src) {
  const list = []
  for (const k of NESTED_USER_KEYS) {
    const o = src?.[k]
    if (isObj(o)) {
      list.push(o)
      if (isObj(o.profile)) list.push(o.profile)
    }
  }
  return list
}

// avval ichki user obyektlaridan, keyin tekis maydonlardan (user_phone, consumer_phone, ...)
function pick(src, names, plain = true) {
  const scopes = userScopes(src)
  for (const n of names) {
    for (const o of scopes) if (okVal(o[n])) return o[n]
    for (const p of PREFIXES) if (okVal(src?.[p + n])) return src[p + n]
    if (plain && okVal(src?.[n])) return src[n]
  }
  return null
}

function mergeSrc(raw, meta) {
  return {
    ...(raw || {}),
    ...(isObj(meta?.ticket) ? meta.ticket : {}),
    ...(meta || {}),
  }
}

function fmtDT(v) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  const dateOnly = typeof v === 'string' && v.length <= 10
  const date = `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`
  return dateOnly ? date : `${date} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

const objTitle = (o) => (isObj(o) ? first(o.name, o.title, o.name_uz, o.name_ru, o.name_en) : null)

function deriveBooking(src) {
  const cand = [
    src.booking, src.booking_data, src.booking_info, src.order,
    src.reservation, src.appointment, src.related_booking,
    src.booking_detail, src.booking_details,
  ].find(isObj)
  const b = cand || {}

  const nestedObjs = [
    b.venue, b.restaurant, b.place, b.service, b.salon, b.business,
    b.shop, b.branch, b.hotel, b.room, b.property, b.partner,
  ].filter(isObj)

  const id = first(
    cand?.id,
    src.booking_id,
    src.order_id,
    src.reservation_id,
    typeof src.booking === 'string' || typeof src.booking === 'number' ? src.booking : null,
  )
  const number = first(b.number, b.code, b.booking_number, b.public_id, b.reference, src.booking_number)
  const title = first(
    b.service_name, b.venue_name, b.restaurant_name, b.place_name, b.title,
    ...nestedObjs.map(objTitle),
    src.booking_title, src.branch_name, src.venue_name, src.service_name,
    src.restaurant_name, src.place_name,
    cand ? b.name : null,
  )
  const date = first(
    b.date, b.booking_date, b.start_date, b.start_time, b.datetime,
    b.start_at, b.scheduled_at, b.check_in,
    src.booking_date, src.booking_datetime, src.booking_start,
  )
  const time = first(b.time, b.booking_time, src.booking_time)
  const guests = first(
    b.guests, b.guests_count, b.people_count, b.persons, b.party_size, b.seats,
    src.booking_guests, src.guests_count,
  )
  const rawPrice = first(
    b.total_price, b.total_amount, b.total, b.amount, b.price, b.deposit,
    src.booking_total, src.booking_price, src.booking_amount,
  )
  const address = first(b.address, ...nestedObjs.map((o) => o.address), src.branch_address, src.booking_address)
  const status = first(b.status, b.state, src.booking_status)

  if (!id && !number && !title && !date) return null

  const dateText = fmtDT(date)
  return {
    id: id != null ? String(id) : null,
    number: number != null ? String(number) : null,
    title: title != null ? String(title) : null,
    date: dateText ? (time && String(date).length <= 10 ? `${dateText}, ${time}` : dateText) : time,
    guests: guests != null && typeof guests !== 'object' ? String(guests) : null,
    price:
      rawPrice != null && typeof rawPrice !== 'object'
        ? `${Number.isFinite(Number(rawPrice)) ? Number(rawPrice).toLocaleString('uz-UZ') : rawPrice} ${b.currency || 'so‘m'}`
        : null,
    address: typeof address === 'string' ? address : null,
    status: status != null && typeof status !== 'object' ? String(status) : null,
  }
}

function derive(src, audience, ticketId) {
  const s = src || {}
  const fn = pick(s, ['first_name'], false)
  const ln = pick(s, ['last_name'], false)

  // backend ba'zan consumer: "Ali Valiyev" kabi oddiy matn beradi
  const strName = NESTED_USER_KEYS.map((k) => s[k]).find(
    (v) => typeof v === 'string' && v.trim() && Number.isNaN(Number(v)),
  )

  const name =
    pick(s, ['full_name', 'fullname', 'display_name']) ||
    pick(s, ['name', 'username'], false) ||
    [fn, ln].filter(Boolean).join(' ') ||
    strName ||
    pick(s, ['email']) ||
    `Murojaat #${ticketId}`

  const ownerRef = NESTED_USER_KEYS.map((k) => s[k]).find(
    (v) => typeof v === 'number' || (typeof v === 'string' && v && !Number.isNaN(Number(v))),
  )
  const userId = toId(pick(s, ['id'], false) ?? ownerRef)

  return {
    userId,
    user: {
      name: String(name),
      phone: String(pick(s, ['phone', 'phone_number', 'mobile', 'msisdn', 'tel', 'telephone']) ?? '—'),
      email: String(pick(s, ['email']) ?? '—'),
      orders:
        pick(s, ['orders_count', 'total_orders', 'bookings_count', 'total_bookings', 'orders']) ?? null,
      joined:
        fmtDate(pick(s, ['date_joined', 'joined_at', 'registered_at', 'joined', 'created_at'], false)) ||
        '—',
      city: String(pick(s, ['city', 'region']) ?? '—'),
      lang: String(pick(s, ['language', 'lang']) ?? '—'),
      device: String(pick(s, ['device', 'device_model']) ?? '—'),
      os: String(pick(s, ['os', 'platform']) ?? '—'),
      appVersion: String(pick(s, ['app_version', 'version']) ?? '—'),
    },
    booking: deriveBooking(s),
    info: {
      ticketNo: `#${ticketId}`,
      subject: first(s.subject, s.title, s.topic),
      category: first(
        typeof s.category === 'string' ? s.category : objTitle(s.category),
        s.type,
        s.reason,
      ),
      priority: first(s.priority),
      createdAt: fmtDT(s.created_at),
      audience,
    },
  }
}

function formatChat(t, fallbackAudience = 'consumer') {
  if (!t) return null

  const ticketId = toId(first(t.id, t.pk, t.ticket_id))
  if (!ticketId) return null

  const audience = resolveAudience(t, fallbackAudience)
  const id = `${audience}:${ticketId}`

  const d = derive(t, audience, ticketId)
  const chatBase = { user: { name: d.user.name }, userId: d.userId }

  const messages = Array.isArray(t.messages)
    ? t.messages.map((m) => formatMessage(m, chatBase)).filter(Boolean)
    : []

  // ro'yxatda faqat oxirgi xabar kelsa — preview uchun ishlatamiz
  if (!messages.length && t.last_message) {
    const lm = isObj(t.last_message) ? t.last_message : { text: String(t.last_message) }
    const m = formatMessage({ created_at: t.last_message_at || t.updated_at, ...lm }, chatBase)
    if (m) messages.push(m)
  }

  const assignee =
    normalizeAssignee(t.assignee) ||
    normalizeAssignee(t.assigned_to) ||
    first(t.assigned_to_name, t.assignee_name, t.agent_name) ||
    null

  return {
    ...t,
    id,
    ticketId,
    audience,
    raw: t,
    ...d,
    status: normalizeStatus(t.status, !!(assignee || t.assigned_to)),
    assignee,
    unread: first(t.unread_count, t.unread) ?? undefined,
    unread_count: undefined, // ChatList faqat `unread` ni ishlatsin
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
        ? normalizeAssignee(chat?.assignee) || getAgentName()
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
  const list = normalizeList(data)
  return list.map((t) => formatChat(t, audience)).filter(Boolean)
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
  const metaEntries = isObj(data)
    ? Object.entries(data).filter(
      ([k, v]) => !Array.isArray(v) && !['count', 'next', 'previous'].includes(k),
    )
    : []
  const meta = metaEntries.length ? Object.fromEntries(metaEntries) : null
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

  list.meta = meta
  return list
}

// ---------- hook ----------

const NOTICE_MS = 5000

export default function useSupportChat() {
  const [state, dispatch] = useReducer(reducer, null, init)
  const [wsState, setWsState] = useState('connecting')
  const [pollState, setPollState] = useState('idle') // idle | ok | error
  const [notice, setNotice] = useState(null)
  const chatsRef = useRef([])
  const noticeTimer = useRef(null)
  const reloadRef = useRef(() => {})

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

  // 1. Ticketlar: birinchi yuklash + har 5 soniyada yangilash
  useEffect(() => {
    let alive = true
    let initial = true
    let busy = false
    const controller = new AbortController()

    async function tick() {
      if (busy) return
      busy = true
      try {
        const chats = await fetchAllTickets(controller.signal)
        if (!alive) return
        const me = getUserId()
        const mine = me && chats.find((c) => String(c.raw?.assigned_to) === me && c.assignee)
        if (mine) setAgentName(mine.assignee)
        dispatch({ type: initial ? 'set_initial_chats' : 'merge_chats', chats })
        initial = false
        setPollState('ok')
      } catch (err) {
        if (err.name === 'AbortError') return
        console.error('Ticket fetch error:', err)
        if (alive) {
          setPollState('error')
          if (initial) {
            dispatch({ type: 'set_initial_chats', chats: [] })
            initial = false
          }
        }
      } finally {
        busy = false
      }
    }

    reloadRef.current = tick
    tick()
    const timer = setInterval(tick, POLL_LIST_MS)
    return () => {
      alive = false
      clearInterval(timer)
      controller.abort()
    }
  }, [])

  // 2. WebSocket — faqat ochiq ticket uchun: /ws/support/<ticket_id>/<audience>/
  const activeChat = state.chats.find((c) => c.id === state.activeId)
  const wsTicketId = activeChat?.ticketId ?? null
  const wsAudience = activeChat?.audience ?? null
  const wsStatus = wsTicketId ? wsState : 'disabled'

  useEffect(() => {
    if (!wsTicketId || !wsAudience) return

    const chatId = `${wsAudience}:${wsTicketId}`
    const socket = createSupportSocket({
      url: buildSupportWsUrl(wsTicketId, wsAudience),
      onStatus: setWsState,
      onEvent: (e) => {
        // backend: {"type": "connected", ...} yoki xabar:
        // {id, sender_id, sender_name, audience, content, created_at, is_read}
        if (!e || e.type === 'connected') return
        if (e.id == null || e.content == null) return

        const chat = chatsRef.current.find((c) => c.id === chatId)
        if (!chat) return
        dispatch({ type: 'incoming', chatId, message: formatMessage(e, chat) })
      },
    })

    return () => socket.close()
  }, [wsTicketId, wsAudience])

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
        if (alive) dispatch({ type: 'merge_messages', chatId: id, messages, meta: messages.meta })
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

    try {
      const messages = await fetchMessages(chat)
      dispatch({ type: 'merge_messages', chatId: id, messages, meta: messages.meta })
    } catch (err) {
      console.error('Messages fetch error:', err)
    }
  }, [])

  // 5. Xabar yuborish (xato bo'lsa — "failed" holati + qayta yuborish)
  const sendMessage = useCallback(
    async (rawChatId, rawText) => {
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
          body: JSON.stringify({ text, audience: chat.audience }),
        })
        if (!res.ok) throw new Error(`Xabar yuborilmadi (${res.status})`)

        const saved = await readJson(res)
        const real = saved
          ? formatMessage(saved.message || saved, { ...chat, assignee: agentName })
          : null

        if (real?.id) {
          // bu xabar bizniki (agent), backend sender_role bermasa ham
          const mine = { ...real, from: 'agent', senderName: real.senderName || agentName }
          dispatch({ type: 'replace', chatId, tempId, message: mine })
        } else {
          dispatch({ type: 'ack', chatId, messageId: tempId, status: 'delivered' })
        }
      } catch (err) {
        console.error('Send message error:', err)
        dispatch({ type: 'ack', chatId, messageId: tempId, status: 'failed' })
        notify('Xabar yuborilmadi. «Qayta yuborish» tugmasini bosing.')
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
      sendMessage(chatId, msg.text)
    },
    [sendMessage],
  )

  // 6. Statusni o'zgartirish: avval server, keyin UI (xato bo'lsa — UI o'zgarmaydi)
  const setStatus = useCallback(
    async (rawChatId, newStatus) => {
      const chatId = toId(rawChatId)
      if (!chatId || !newStatus) return

      const chat = chatsRef.current.find((c) => c.id === chatId)
      if (!chat || chat.statusBusy) return

      dispatch({ type: 'patch', chatId, patch: { statusBusy: true } })

      const endpoint =
        newStatus === 'resolved'
          ? `/tickets/${chat.ticketId}/resolve/`
          : `/tickets/${chat.ticketId}/assign/`

      try {
        const res = await api(endpoint, {
          method: 'POST',
          body: JSON.stringify({ status: newStatus, audience: chat.audience }),
        })
        if (!res.ok) throw new Error(`Status yangilanmadi (${res.status})`)

        const data = await readJson(res)
        const assignee = first(data?.assigned_to_name, chat.assignee)
        if (assignee && String(data?.assigned_to) === getUserId()) setAgentName(assignee)

        dispatch({
          type: 'status',
          chatId,
          status: newStatus,
          assignee: newStatus === 'resolved' ? undefined : assignee,
          by: getAgentName(),
        })
      } catch (err) {
        console.error('Status update error:', err)
        notify('Holatni o‘zgartirib bo‘lmadi. Qayta urinib ko‘ring.')
      } finally {
        dispatch({ type: 'patch', chatId, patch: { statusBusy: false } })
      }
    },
    [notify],
  )

  const reload = useCallback(() => reloadRef.current(), [])

  const active = useMemo(
    () => state.chats.find((c) => c.id === state.activeId) ?? null,
    [state.chats, state.activeId],
  )

  // connected — WS ulangan (real-time); polling — faqat har 5 s da yangilanadi;
  // offline — server javob bermayapti; connecting — birinchi yuklash
  const connection =
    wsStatus === 'connected'
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
    select,
    sendMessage,
    retryMessage,
    setStatus,
    reload,
    dismissNotice,
  }
}
