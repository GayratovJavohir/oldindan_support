import { useMemo, useState } from 'react'
import Avatar from './Avatar'
import { IconSearch, IconInbox } from './Icons'
import { listTime, STATUS } from './format'

const TABS = [
  { id: 'all', label: 'Barchasi' },
  { id: 'new', label: 'Yangi' },
  { id: 'open', label: 'Jarayonda' },
  { id: 'resolved', label: 'Yopilgan' },
]

const lastOf = (c) => [...(c.messages || [])].reverse().find((m) => m.from !== 'system')

export default function ChatList({ chats, activeId, onSelect }) {
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')

  const counts = useMemo(() => {
    const r = { all: chats.length, new: 0, open: 0, resolved: 0 }
    chats.forEach((c) => { if (r[c.status] !== undefined) r[c.status] += 1 })
    return r
  }, [chats])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return chats
      .filter((c) => tab === 'all' || c.status === tab)
      .filter((c) => {
        if (!term) return true
        const last = lastOf(c)?.text ?? ''
        // Django backend maydonlariga moslash (user_name yoki user.name)
        const userName = c.user?.name || c.user_name || c.consumer_name || ''
        const userPhone = c.user?.phone || c.user_phone || c.consumer_phone || ''
        return `${userName} ${userPhone} ${last}`.toLowerCase().includes(term)
      })
      .sort((a, b) => {
        const rank = { new: 0, open: 1, resolved: 2 }
        if ((rank[a.status] ?? 3) !== (rank[b.status] ?? 3)) return (rank[a.status] ?? 3) - (rank[b.status] ?? 3)
        return (lastOf(b)?.ts ?? 0) - (lastOf(a)?.ts ?? 0)
      })
  }, [chats, tab, q])

  return (
    <aside className="sp-list">
      <header className="sp-list__head">
        <div className="sp-list__title">
          <h2>Murojaatlar</h2>
          <span className="sp-list__queue" title="Hamma xodim ko'radi">Umumiy navbat</span>
        </div>
        <label className="sp-search">
          <IconSearch size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ism, telefon yoki xabar bo'yicha" />
        </label>
        <div className="sp-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id}
              className={`sp-tab ${tab === t.id ? 'is-on' : ''} ${t.id === 'new' ? 'sp-tab--new' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}<b>{counts[t.id]}</b>
            </button>
          ))}
        </div>
      </header>

      <ul className="sp-list__rows">
        {rows.map((c) => {
          const last = lastOf(c)
          const st = STATUS[c.status] || STATUS.new
          const userName = c.user?.name || c.user_name || c.consumer_name || `Murojaat #${c.id}`
          const unreadCount = c.unread_count ?? c.unread ?? 0

          return (
            <li key={c.id}>
              <button className={`sp-row ${c.id === activeId ? 'is-active' : ''} ${unreadCount ? 'is-unread' : ''}`} onClick={() => onSelect(c.id)}>
                <Avatar name={userName} online={c.status !== 'resolved'} />
                <span className="sp-row__body">
                  <span className="sp-row__top">
                    <strong>{userName}</strong>
                    <time>{last ? listTime(last.ts) : ''}</time>
                  </span>
                  <span className="sp-row__msg">
                    {c.typing
                      ? <em className="sp-row__typing">yozmoqda…</em>
                      : <>{last?.from === 'agent' && <span className="sp-row__you">Siz: </span>}{last?.text || 'Xabarlar yo‘q'}</>}
                  </span>
                  <span className="sp-row__meta">
                    <span className={`sp-pill sp-pill--${st.tone}`}>{st.label}</span>
                    {c.priority === 'high' && <span className="sp-pill sp-pill--hot">Shoshilinch</span>}
                    {c.tags?.[0] && <span className="sp-tag">{c.tags[0]}</span>}
                    {unreadCount > 0 && <span className="sp-badge">{unreadCount}</span>}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
        {!rows.length && (
          <li className="sp-empty-list">
            <IconInbox size={30} />
            <p>Hech narsa topilmadi</p>
          </li>
        )}
      </ul>
    </aside>
  )
}