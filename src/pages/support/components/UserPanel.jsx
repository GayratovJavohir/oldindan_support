import { useEffect } from 'react'
import Avatar from './Avatar'
import { STATUS } from './format'
import {
  IconBag,
  IconBook,
  IconClock,
  IconClose,
  IconInfo,
  IconPhone,
  IconPin,
  IconUsers,
} from './Icons'

// backend bermagan qiymatlar: bo'sh, null, "None" yoki "—"
const has = (v) => v !== null && v !== undefined && v !== '' && v !== '—' && v !== 'None'

const p2 = (n) => String(n).padStart(2, '0')
function fmtDT(v) {
  if (!v) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v)
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

const phoneHref = (p) => {
  const digits = String(p || '').replace(/[^\d+]/g, '')
  return digits.length >= 5 ? `tel:${digits}` : null
}

const price = (v) => {
  if (!has(v)) return null
  const n = Number(v)
  return Number.isFinite(n) ? `${n.toLocaleString('uz-UZ')} so‘m` : String(v)
}

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

function BookingCard({ b }) {
  const time = [b.time, b.start_time && !b.time ? b.start_time : null].find(has)
  const date = [b.date, time].filter(has).join(' ')
  const end = has(b.end_time) ? `— ${b.end_time}` : ''
  return (
    <div className="sp-bk">
      <div className="sp-bk__head">
        <span className="sp-bk__ico">
          <IconBook size={18} />
        </span>
        <div>
          <strong>{b.branch_name || `Bron #${b.id}`}</strong>
          <small>№ {b.id}</small>
        </div>
        {has(b.status) && <span className="sp-pill sp-pill--amber">{b.status}</span>}
      </div>
      <Section
        rows={[
          { icon: <IconClock size={16} />, label: 'Sana', value: has(date) ? `${date} ${end}`.trim() : null },
          { icon: <IconUsers size={16} />, label: 'Mehmonlar', value: b.guests ?? b.party_size },
          { icon: <IconBag size={16} />, label: 'Summa', value: price(b.total_price) },
          { icon: <IconPhone size={16} />, label: 'Filial tel.', value: b.branch_phone },
          { icon: <IconClock size={16} />, label: 'Yaratilgan', value: fmtDT(b.created_at) },
        ]}
      />
    </div>
  )
}

export default function UserPanel({ chat, onClose, onLoadBookings }) {
  const chatId = chat?.id

  // panel ochilganda / suhbat almashganda user'ning bronlarini olamiz
  useEffect(() => {
    if (chatId) onLoadBookings?.(chatId)
  }, [chatId, onLoadBookings])

  if (!chat) return null

  const { user } = chat
  const href = phoneHref(user.phone)
  const st = STATUS[chat.status] || STATUS.new
  const bookings = chat.bookings

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
          <span className="sp-tag sp-tag--accent">Mijoz</span>
        </div>
      </div>

      <Section
        title="Suhbat"
        rows={[
          { icon: <IconInfo size={16} />, label: 'Raqam', value: `#${chat.id}` },
          { icon: <IconInfo size={16} />, label: 'Holat', value: st.label },
          { icon: <IconBag size={16} />, label: "Mas'ul xodim", value: chat.assignee },
          { icon: <IconClock size={16} />, label: 'Ochilgan', value: fmtDT(chat.createdAt) },
          { icon: <IconClock size={16} />, label: 'Oxirgi xabar', value: fmtDT(chat.lastTs) },
          { icon: <IconClock size={16} />, label: 'Yopilgan', value: fmtDT(chat.closedAt) },
          { icon: <IconUsers size={16} />, label: 'Yopgan xodim', value: chat.closedBy },
        ]}
      />

      <section className="sp-info__sec sp-info__booking">
        <h4>So‘nggi bronlar</h4>
        {bookings == null && <p className="sp-info__empty">Yuklanmoqda…</p>}
        {bookings != null && chat.bookingsError && (
          <p className="sp-info__empty sp-info__empty--err">
            {chat.bookingsError}{' '}
            <button type="button" className="sp-link" onClick={() => onLoadBookings?.(chat.id)}>
              Qayta urinish
            </button>
          </p>
        )}
        {bookings != null && !chat.bookingsError && !bookings.length && (
          <p className="sp-info__empty">
            <IconPin size={14} /> Bronlar topilmadi
          </p>
        )}
        <div className="sp-bk-list">
          {(bookings || []).map((b) => (
            <BookingCard key={b.id} b={b} />
          ))}
        </div>
      </section>
    </aside>
  )
}