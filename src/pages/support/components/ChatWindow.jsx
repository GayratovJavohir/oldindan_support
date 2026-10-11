import { Fragment, useEffect, useRef, useState } from 'react'
import Avatar from './Avatar'
import {
  IconBack,
  IconBolt,
  IconCheck,
  IconChecks,
  IconClock,
  IconInfo,
  IconSend,
  IconChat,
} from './Icons'
import { dayLabel, hhmm, STATUS } from './format'

const QUICK_REPLIES = [
  { label: 'Salom!', text: 'Assalomu alaykum! Sizga qanday yordam bera olaman?' },
  { label: 'Tekshirilmoqda', text: 'Muammo bo‘yicha mutaxassislarga xabar berildi, tekshirilmoqda.' },
  { label: 'Hal qilindi', text: 'Murojaatingiz hal qilindi. Yana savollar bo‘lsa murojaat qilishingiz mumkin.' },
]

function Ticks({ status }) {
  if (status === 'sending') return <IconClock size={13} className="tick" />
  if (status === 'read') return <IconChecks size={15} className="tick tick--read" />
  if (status === 'delivered') return <IconChecks size={15} className="tick" />
  return <IconCheck size={14} className="tick" />
}

export default function ChatWindow({
  chat,
  onSend,
  onStatus,
  onRetry,
  onBack,
  onToggleInfo,
  infoOpen,
}) {
  const [text, setText] = useState('')
  const [quick, setQuick] = useState(false)
  const endRef = useRef(null)
  const taRef = useRef(null)

  const messages = chat?.messages || []
  const count = messages.length

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [count, chat?.id, chat?.typing])

  if (!chat) {
    return (
      <section className="sp-chat sp-chat--empty">
        <div className="sp-hello">
          <span className="sp-hello__mark">
            <IconChat size={34} />
          </span>
          <h2>Murojaatni tanlang</h2>
          <p>Chap tomondagi navbatdan foydalanuvchi murojaatini oching va javob yozing.</p>
        </div>
      </section>
    )
  }

  const submit = () => {
    const v = text.trim()
    if (!v) return
    onSend(chat.id, v)
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

  const st = STATUS[chat.status] || STATUS.new
  const resolved = chat.status === 'resolved'
  const userName =
    chat.user?.name || chat.user_name || chat.consumer_name || `Murojaat #${chat.id}`
  const userPhone =
    chat.user?.phone || chat.user_phone || chat.consumer_phone || ''

  return (
    <section className="sp-chat">
      <header className="sp-chat__head">
        <button
          className="sp-iconbtn sp-only-mobile"
          onClick={onBack}
          aria-label="Orqaga"
        >
          <IconBack />
        </button>
        <Avatar name={userName} size={42} online={!resolved} />
        <div className="sp-chat__who">
          <strong>{userName}</strong>
          <span>
            {chat.typing ? (
              <em className="sp-typing-text">yozmoqda…</em>
            ) : (
              <>
                {userPhone}
                {chat.booking?.title && (
                  <>
                    <i className="sp-dot" />
                    {chat.booking.title}
                  </>
                )}
                <i className={`sp-dot sp-dot--${st.tone}`} />
                {st.label}
              </>
            )}
          </span>
        </div>
        <div className="sp-chat__actions">
          {chat.status === 'new' && (
            <button
              className="sp-btn sp-btn--ghost"
              disabled={chat.statusBusy}
              onClick={() => onStatus(chat.id, 'open')}
            >
              Qabul qilish
            </button>
          )}
          {resolved ? (
            <button
              className="sp-btn sp-btn--ghost"
              disabled={chat.statusBusy}
              onClick={() => onStatus(chat.id, 'open')}
            >
              Qayta ochish
            </button>
          ) : (
            <button
              className="sp-btn sp-btn--solid"
              disabled={chat.statusBusy}
              onClick={() => onStatus(chat.id, 'resolved')}
            >
              <IconCheck size={16} />
              <span className="sp-btn__t">Hal qilindi</span>
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
                  <div className={`sp-msg sp-msg--${m.from}`}>
                    <div className={`sp-bubble ${m.status === 'failed' ? 'sp-bubble--failed' : ''}`}>
                      {m.senderName && (
                        <span className="sp-bubble__agent">{m.senderName}</span>
                      )}
                      <p>{m.text}</p>
                      <span className="sp-bubble__meta">
                        {hhmm(m.ts)}
                        {m.from === 'agent' && m.status !== 'failed' && <Ticks status={m.status} />}
                      </span>
                      {m.status === 'failed' && (
                        <button
                          type="button"
                          className="sp-retry"
                          onClick={() => onRetry(chat.id, m.id)}
                        >
                          Yuborilmadi · Qayta yuborish
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Fragment>
            )
          })}
          {chat.typing && (
            <div className="sp-msg sp-msg--user">
              <div className="sp-bubble sp-bubble--typing">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <footer className="sp-composer">
        {quick && (
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
        <div className="sp-composer__box">
          <button
            className={`sp-iconbtn ${quick ? 'is-on' : ''}`}
            onClick={() => setQuick((v) => !v)}
            aria-label="Tayyor javoblar"
            title="Tayyor javoblar"
          >
            <IconBolt />
          </button>
          <textarea
            ref={taRef}
            rows={1}
            value={text}
            onChange={grow}
            onKeyDown={onKey}
            placeholder={
              resolved ? 'Murojaat yopilgan. Yozsangiz qayta ochiladi…' : 'Javob yozing…'
            }
          />
          <button
            className="sp-send"
            onClick={submit}
            disabled={!text.trim()}
            aria-label="Yuborish"
          >
            <IconSend size={19} />
          </button>
        </div>
        <p className="sp-composer__hint">
          Enter — yuborish, Shift + Enter — yangi qator
        </p>
      </footer>
    </section>
  )
}