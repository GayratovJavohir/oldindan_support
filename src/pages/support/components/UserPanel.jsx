import { useMemo } from 'react'
import Avatar from './Avatar'
import {
  IconBag,
  IconBook,
  IconClock,
  IconClose,
  IconInfo,
  IconPhone,
  IconPhone2,
  IconPin,
  IconUsers,
} from './Icons'

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v)

// backend bermagan qiymatlar: bo'sh, null yoki "—"
const has = (v) => v !== null && v !== undefined && v !== '' && v !== '—'

// faqat qiymati bor qatorlarni chizadi; hammasi bo'sh bo'lsa, bo'limning o'zi chiqmaydi
function Section({ title, rows, className = '' }) {
  const list = rows.filter((r) => has(r.value))
  if (!list.length) return null
  return (
    <section className={`sp-info__sec ${className}`}>
      {title && <h4>{title}</h4>}
      {list.map((r) => (
        <div className="sp-info__row" key={r.label}>
          <span className="sp-info__ico">{r.icon}</span>
          <span className="sp-info__label">{r.label}</span>
          <strong>{r.value}</strong>
        </div>
      ))}
    </section>
  )
}

// backend yuborgan hamma maydonni (ichma-ich ham) "kalit: qiymat" ko'rinishida yoyish
function flatten(obj, prefix = '', out = [], depth = 0) {
  if (!isObj(obj) || depth > 3) return out
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v === null || v === undefined || v === '') continue
    if (isObj(v)) flatten(v, key, out, depth + 1)
    else if (Array.isArray(v)) {
      if (v.length && v.every((x) => typeof x !== 'object')) out.push([key, v.join(', ')])
    } else out.push([key, String(v)])
  }
  return out
}

const LABELS = {
  id: 'Murojaat ID',
  subject: 'Mavzu',
  status: 'Holat',
  consumer: 'Mijoz ID',
  consumer_name: 'Mijoz ismi',
  branch: 'Filial ID',
  branch_name: 'Filial',
  booking: 'Bron ID',
  booking_number: 'Bron raqami',
  assigned_to: 'Xodim ID',
  assigned_to_name: "Mas'ul xodim",
  created_at: 'Yaratilgan',
  updated_at: 'Yangilangan',
}

const STATUS_UZ = {
  new: 'Yangi',
  open: 'Ochiq',
  in_progress: 'Jarayonda',
  assigned: 'Qabul qilingan',
  pending: 'Kutilmoqda',
  resolved: 'Hal qilingan',
  closed: 'Yopilgan',
}

const p2 = (n) => String(n).padStart(2, '0')
const fmtDT = (v) => {
  const d = new Date(v)
  if (!v || Number.isNaN(d.getTime())) return v
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}
const showVal = (k, v) => {
  if (k === 'status') return STATUS_UZ[v] || v
  if (/_at$/.test(k)) return fmtDT(v)
  return v
}

const HIDE_KEYS = /(^messages|^last_message|password|token|^detail)/i

const phoneHref = (p) => {
  const digits = String(p || '').replace(/[^\d+]/g, '')
  return digits.length >= 5 ? `tel:${digits}` : null
}

export default function UserPanel({ chat, onClose }) {
  const allFields = useMemo(() => {
    if (!chat) return []
    const merged = { ...(chat.raw || {}), ...(isObj(chat.detail) ? chat.detail : {}) }
    return flatten(merged).filter(([k]) => !HIDE_KEYS.test(k))
  }, [chat])

  if (!chat || !chat.user) return null

  const { user, booking } = chat
  const info = chat.info || {}
  const tags = chat.tags || []
  const href = phoneHref(user.phone)
  const audienceLabel = chat.audience === 'partner' ? 'Hamkor' : 'Mijoz'
  const showStats = has(user.orders) || has(user.joined)
  const raw = { ...(chat.raw || {}), ...(isObj(chat.detail) ? chat.detail : {}) }

  return (
    <aside className="sp-info">
      <button className="sp-iconbtn sp-info__close" onClick={onClose} aria-label="Yopish">
        <IconClose size={18} />
      </button>

      <div className="sp-info__card">
        <Avatar name={user.name} size={72} />
        <h3>{user.name}</h3>
        {has(user.phone) &&
          (href ? (
            <a href={href} className="sp-info__phone">
              <IconPhone size={15} />
              {user.phone}
            </a>
          ) : (
            <span className="sp-info__phone">
              <IconPhone size={15} />
              {user.phone}
            </span>
          ))}
        {has(user.email) && <span className="sp-info__mail">{user.email}</span>}
        <div className="sp-info__tags">
          <span className="sp-tag sp-tag--accent">{audienceLabel}</span>
          {tags.map((t) => (
            <span key={String(isObj(t) ? t.id ?? t.name : t)} className="sp-tag">
              {isObj(t) ? t.name || t.title : t}
            </span>
          ))}
        </div>
      </div>

      {showStats && (
        <div className="sp-info__stats">
          {has(user.orders) && (
            <div>
              <b>{user.orders}</b>
              <span>buyurtma</span>
            </div>
          )}
          {has(user.joined) && (
            <div>
              <b>{user.joined}</b>
              <span>ro'yxatdan o'tgan</span>
            </div>
          )}
        </div>
      )}

      {booking && (
        <section className="sp-info__sec sp-info__booking">
          <h4>Qaysi bron uchun</h4>
          <div className="sp-bk">
            <div className="sp-bk__head">
              <span className="sp-bk__ico">
                <IconBook size={18} />
              </span>
              <div>
                <strong>{booking.title || `Bron #${booking.number || booking.id}`}</strong>
                {has(booking.number || booking.id) && <small>№ {booking.number || booking.id}</small>}
              </div>
              {has(booking.status) && <span className="sp-pill sp-pill--amber">{booking.status}</span>}
            </div>
            <Section
              rows={[
                { icon: <IconClock size={16} />, label: 'Sana', value: booking.date },
                { icon: <IconUsers size={16} />, label: 'Mehmonlar', value: booking.guests },
                { icon: <IconBag size={16} />, label: 'Summa', value: booking.price },
                { icon: <IconPin size={16} />, label: 'Manzil', value: booking.address },
              ]}
            />
          </div>
        </section>
      )}

      <Section
        title="Murojaat"
        rows={[
          { icon: <IconInfo size={16} />, label: 'Raqam', value: info.ticketNo },
          { icon: <IconInfo size={16} />, label: 'Mavzu', value: info.subject },
          { icon: <IconInfo size={16} />, label: 'Holat', value: STATUS_UZ[raw.status] || raw.status },
          { icon: <IconInfo size={16} />, label: 'Kategoriya', value: info.category },
          { icon: <IconInfo size={16} />, label: 'Muhimlik', value: info.priority },
          {
            icon: <IconPin size={16} />,
            label: 'Filial',
            value: raw.branch_name || (raw.branch != null ? `#${raw.branch}` : null),
          },
          { icon: <IconBook size={16} />, label: 'Bron raqami', value: raw.booking_number || booking?.number },
          { icon: <IconBag size={16} />, label: "Mas'ul xodim", value: chat.assignee },
          { icon: <IconClock size={16} />, label: 'Yaratilgan', value: info.createdAt },
          { icon: <IconClock size={16} />, label: 'Yangilangan', value: raw.updated_at ? fmtDT(raw.updated_at) : null },
        ]}
      />

      <Section
        title="Foydalanuvchi"
        rows={[
          { icon: <IconUsers size={16} />, label: 'Mijoz ID', value: raw.consumer ?? raw.consumer_id ?? raw.partner },
          { icon: <IconPin size={16} />, label: 'Shahar', value: user.city },
          { icon: <IconUsers size={16} />, label: 'Til', value: user.lang },
        ]}
      />

      <Section
        title="Qurilma va ilova"
        rows={[
          { icon: <IconPhone2 size={16} />, label: 'Qurilma', value: user.device },
          { icon: <IconPhone2 size={16} />, label: 'Tizim', value: user.os },
          { icon: <IconPhone2 size={16} />, label: 'Ilova versiyasi', value: user.appVersion },
        ]}
      />

      {allFields.length > 0 && (
        <details className="sp-info__sec sp-raw" open>
          <summary>Backend ma'lumotlari ({allFields.length})</summary>
          <dl>
            {allFields.map(([k, v]) => (
              <div key={k}>
                <dt>{LABELS[k] ? `${LABELS[k]} · ${k}` : k}</dt>
                <dd>{showVal(k, v)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </aside>
  )
}