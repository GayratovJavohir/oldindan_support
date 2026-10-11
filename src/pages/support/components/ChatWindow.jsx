import { Fragment, useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import TransferMenu from './TransferMenu'
import {
  IconBack,
  IconBolt,
  IconCheck,
  IconChecks,
  IconClock,
  IconInfo,
  IconLock,
  IconSend,
  IconChat,
} from './Icons'
import { dayLabel, hhmm, STATUS } from './format'
import { getUserId } from '../../../lib/auth'

const QUICK_REPLIES = [
  { label: 'Salom!', text: 'Assalomu alaykum! Sizga qanday yordam bera olaman?' },
  { label: 'Tekshirilmoqda', text: 'Muammo bo‘yicha mutaxassislarga xabar berildi, tekshirilmoqda.' },
  { label: 'Hal qilindi', text: 'Murojaatingiz hal qilindi. Yana savollar bo‘lsa murojaat qilishingiz mumkin.' },
]

function Ticks({ status }) {
  if (status === 'sending') return <IconClock size={13} className="tick" />
  if (status === 'read') return <IconChecks size={15} className="tick tick--read" />
  return <IconCheck size={14} className="tick" />
}

// Parent `key={chat.id}` beradi — suhbat almashganda matn va rejim tozalanadi
export default function ChatWindow({
  chat,
  agents,
  onSend,
  onClaim,
  onClose,
  onReopen,
  onTransfer,
  onLoadAgents,
  onLoadOlder,
  onRetry,
  onBack,
  onToggleInfo,
  infoOpen,
}) {
  const [text, setText] = useState('')
  const [quick, setQuick] = useState(false)
  const [internal, setInternal] = useState(false)
  const endRef = useRef(null)
  const taRef = useRef(null)

  const messages = chat?.messages || []
  const lastId = messages[messages.length - 1]?.id

  // faqat yangi xabar kelganda pastga tushamiz (eski xabarlar yuklanganda sakramaydi)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [lastId, chat?.id])

  if (!chat) {
    return (
      <section className="sp-chat sp-chat--empty">
        <div className="sp-hello">
          <span className="sp-hello__mark">
            <IconChat size={34} />
          </span>
          <h2>Suhbatni tanlang</h2>
          <p>Chap tomondagi navbatdan foydalanuvchi suhbatini oching va javob yozing.</p>
        </div>
      </section>
    )
  }

  const resolved = chat.status === 'resolved'
  const mine = !!chat.assigneeId && chat.assigneeId === getUserId()
  const st = STATUS[chat.status] || STATUS.new

  const submit = () => {
    const v = text.trim()
    if (!v || resolved) return
    onSend(chat.id, v, { internal })
    setText('')
    setQuick(false)
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const grow = (e) => {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
  }

  const placeholder = resolved
    ? 'Suhbat yopilgan. Yozish uchun avval qayta oching.'
    : internal
      ? 'Ichki eslatma (foydalanuvchi ko‘rmaydi)…'
      : 'Javob yozing…'

  return (
    <section className="sp-chat">
      <header className="sp-chat__head">
        <button className="sp-iconbtn sp-only-mobile" onClick={onBack} aria-label="Orqaga">
          <IconBack />
        </button>
        <Avatar name={chat.user.name} size={42} online={!resolved} />
        <div className="sp-chat__who">
          <strong>{chat.user.name}</strong>
          <span>
            {chat.user.phone}
            <i className={`sp-dot sp-dot--${st.tone}`} />
            {st.label}
            {chat.assignee && (
              <>
                <i className="sp-dot" />
                {mine ? 'Siz' : chat.assignee}
              </>
            )}
          </span>
        </div>
        <div className="sp-chat__actions">
          {!resolved && !mine && (
            <button
              className="sp-btn sp-btn--ghost"
              disabled={chat.statusBusy}
              onClick={() => onClaim(chat.id)}
            >
              Qabul qilish
            </button>
          )}
          {!resolved && (
            <TransferMenu
              agents={agents}
              disabled={chat.statusBusy}
              onOpen={onLoadAgents}
              onTransfer={(agentId, note) => onTransfer(chat.id, agentId, note)}
            />
          )}
          {resolved ? (
            <button
              className="sp-btn sp-btn--ghost"
              disabled={chat.statusBusy}
              onClick={() => onReopen(chat.id)}
            >
              Qayta ochish
            </button>
          ) : (
            <button
              className="sp-btn sp-btn--solid"
              disabled={chat.statusBusy}
              onClick={() => onClose(chat.id)}
            >
              <IconCheck size={16} />
              <span className="sp-btn__t">Yopish</span>
            </button>
          )}
          <button
            className={`sp-iconbtn ${infoOpen ? 'is-on' : ''}`}
            onClick={onToggleInfo}
            aria-label="Foydalanuvchi ma'lumoti"
          >
            <IconInfo />
          </button>
        </div>
      </header>

      <div className="sp-chat__scroll">
        <div className="sp-chat__inner">
          {chat.nextCursor && (
            <button
              type="button"
              className="sp-loadmore"
              disabled={chat.loadingOlder}
              onClick={() => onLoadOlder(chat.id)}
            >
              {chat.loadingOlder ? 'Yuklanmoqda…' : 'Oldingi xabarlarni yuklash'}
            </button>
          )}

          {messages.map((m, i) => {
            const d = dayLabel(m.ts)
            const sep = i === 0 || d !== dayLabel(messages[i - 1].ts)
            return (
              <Fragment key={m.id || i}>
                {sep && (
                  <div className="sp-day">
                    <span>{d}</span>
                  </div>
                )}
                {m.from === 'system' ? (
                  <div className="sp-sys">
                    <IconClock size={13} />
                    {m.text}
                    <time>{hhmm(m.ts)}</time>
                  </div>
                ) : (
                  <div className={`sp-msg sp-msg--${m.from} ${m.internal ? 'sp-msg--internal' : ''}`}>
                    <div className={`sp-bubble ${m.status === 'failed' ? 'sp-bubble--failed' : ''}`}>
                      {m.internal && (
                        <span className="sp-bubble__label">
                          <IconLock size={12} /> Ichki eslatma
                        </span>
                      )}
                      {m.senderName && <span className="sp-bubble__agent">{m.senderName}</span>}
                      {m.booking && (
                        <span className="sp-bubble__bk">
                          Bron #{m.booking.id}
                          {m.booking.branch ? ` · ${m.booking.branch}` : ''}
                        </span>
                      )}
                      <p>{m.text}</p>
                      <span className="sp-bubble__meta">
                        {hhmm(m.ts)}
                        {m.from === 'agent' && !m.internal && m.status !== 'failed' && (
                          <Ticks status={m.status} />
                        )}
                      </span>
                      {m.status === 'failed' && (
                        <button type="button" className="sp-retry" onClick={() => onRetry(chat.id, m.id)}>
                          Yuborilmadi · Qayta yuborish
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Fragment>
            )
          })}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="sp-composer">
        {resolved && (
          <div className="sp-composer__closed">
            <span>Suhbat yopilgan.</span>
            <button
              type="button"
              className="sp-btn sp-btn--ghost"
              disabled={chat.statusBusy}
              onClick={() => onReopen(chat.id)}
            >
              Qayta ochish
            </button>
          </div>
        )}
        {quick && !resolved && (
          <div className="sp-quick">
            {QUICK_REPLIES.map((r) => (
              <button
                key={r.label}
                onClick={() => {
                  setText(r.text)
                  setQuick(false)
                  taRef.current?.focus()
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        <div className={`sp-composer__box ${internal ? 'is-internal' : ''}`}>
          <button
            className={`sp-iconbtn ${quick ? 'is-on' : ''}`}
            onClick={() => setQuick((v) => !v)}
            disabled={resolved}
            aria-label="Tayyor javoblar"
            title="Tayyor javoblar"
          >
            <IconBolt />
          </button>
          <button
            className={`sp-iconbtn ${internal ? 'is-on' : ''}`}
            onClick={() => setInternal((v) => !v)}
            disabled={resolved}
            aria-pressed={internal}
            aria-label="Ichki eslatma"
            title="Ichki eslatma — foydalanuvchi ko‘rmaydi"
          >
            <IconLock />
          </button>
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            disabled={resolved}
            onChange={grow}
            onKeyDown={onKey}
            placeholder={placeholder}
          />
          <button
            className="sp-send"
            onClick={submit}
            disabled={!text.trim() || resolved}
            aria-label="Yuborish"
          >
            <IconSend size={19} />
          </button>
        </div>
        <p className="sp-composer__hint">
          {internal
            ? 'Ichki eslatma rejimi — faqat xodimlar ko‘radi'
            : 'Enter — yuborish, Shift + Enter — yangi qator'}
        </p>
      </footer>
    </section>
  )
}