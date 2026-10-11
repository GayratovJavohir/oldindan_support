import { useMemo, useState } from 'react'
import Avatar from './Avatar'
import { IconSearch, IconInbox } from './Icons'
import { listTime, STATUS } from './format'
import { getUserId } from '../../../lib/auth'

const TABS = [
  { id: 'all', label: 'Barchasi' },
  { id: 'new', label: 'Yangi' },
  { id: 'open', label: 'Jarayonda' },
  { id: 'mine', label: 'Mening' },
  { id: 'resolved', label: 'Yopilgan' },
]

// yuklangan xabarlardan oxirgisi, bo'lmasa serverdagi last_message preview
const lastOf = (c) =>
  [...(c.messages || [])].reverse().find((m) => m.from !== 'system') || c.preview

export default function ChatList({ chats, activeId, onSelect, loading = false }) {
  const [tab, setTab] = useState('all')
  const [q, setQ] = useState('')
  const me = getUserId()

  const isMine = (c) => c.status !== 'resolved' && !!me && c.assigneeId === me

  const counts = useMemo(() => {
    const r = { all: chats.length, new: 0, open: 0, mine: 0, resolved: 0 }
    chats.forEach((c) => {
      if (r[c.status] !== undefined) r[c.status] += 1
      if (c.status !== 'resolved' && me && c.assigneeId === me) r.mine += 1
    })
    return r
  }, [chats, me])

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    const mine = (c) => c.status !== 'resolved' && !!me && c.assigneeId === me
    return chats
      .filter((c) => {
        if (tab === 'all') return true
        if (tab === 'mine') return mine(c)
        return c.status === tab
      })
      .filter((c) => {
        if (!term) return true
        const last = lastOf(c)?.text ?? ''
        const hay = `${c.user.name} ${c.user.phone || ''} ${c.user.email || ''} ${c.assignee || ''} ${last}`
        return hay.toLowerCase().includes(term)
      })
      .sort((a, b) => {
        const rank = { new: 0, open: 1, resolved: 2 }
        if ((rank[a.status] ?? 3) !== (rank[b.status] ?? 3)) {
          return (rank[a.status] ?? 3) - (rank[b.status] ?? 3)
        }
        return (b.lastTs || 0) - (a.lastTs || 0)
      })
  }, [chats, tab, q, me])

  return (
    <aside className="sp-list">
      <header className="sp-list__head">
        <div className="sp-list__title">
          <h2>Suhbatlar</h2>
          <span className="sp-list__queue" title="Hamma xodim ko'radi">Umumiy navbat</span>
        </div>
        <label className="sp-search">
          <IconSearch size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ism, telefon, email yoki xabar bo'yicha"
          />
        </label>
        <div className="sp-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`sp-tab ${tab === t.id ? 'is-on' : ''} ${t.id === 'new' ? 'sp-tab--new' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}<b>{counts[t.id]}</b>
            </button>
          ))}
        </div>
      </header>

      <ul className="sp-list__rows">
        {rows.map((c) => {
          const last = lastOf(c)
          const st = STATUS[c.status] || STATUS.new
          const unreadCount = c.unread ?? 0

          return (
            <li key={c.id}>
              <button
                className={`sp-row ${c.id === activeId ? 'is-active' : ''} ${unreadCount ? 'is-unread' : ''}`}
                onClick={() => onSelect(c.id)}
              >
                <Avatar name={c.user.name} online={c.status !== 'resolved'} />
                <span className="sp-row__body">
                  <span className="sp-row__top">
                    <strong>{c.user.name}</strong>
                    <time>{last?.ts ? listTime(last.ts) : c.lastTs ? listTime(c.lastTs) : ''}</time>
                  </span>
                  <span className="sp-row__msg">
                    {last?.internal && <span className="sp-row__you">Ichki: </span>}
                    {last?.from === 'agent' && !last.internal && <span className="sp-row__you">Xodim: </span>}
                    {last?.text || 'Xabarlar yo‘q'}
                  </span>
                  <span className="sp-row__meta">
                    <span className={`sp-pill sp-pill--${st.tone}`}>{st.label}</span>
                    <span className="sp-tag" title="Suhbat raqami">#{c.id}</span>
                    {c.assignee && (
                      <span
                        className={`sp-tag ${isMine(c) ? 'sp-tag--accent' : ''}`}
                        title="Mas'ul xodim"
                      >
                        {isMine(c) ? 'Siz' : c.assignee}
                      </span>
                    )}
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
            <p>{loading ? 'Yuklanmoqda…' : 'Hech narsa topilmadi'}</p>
          </li>
        )}
      </ul>
    </aside>
  )
}