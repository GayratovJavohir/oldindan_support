import { useState } from 'react'
import ChatList from './components/ChatList'
import ChatWindow from './components/ChatWindow'
import UserPanel from './components/UserPanel'
// ❗ default import bo'lishi kerak:
import useSupportChat from '../../hooks/useSupportChat'
import './support.css'
import './support-extra.css'

const CONN = {
  connected: 'Jonli ulangan',
  polling: 'Har 5 soniyada yangilanadi',
  connecting: 'Ulanmoqda…',
  offline: 'Aloqa yo‘q',
}

export default function SupportPage() {
  const {
    chats,
    active,
    loading,
    error,
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
  } = useSupportChat()
  const [infoOpen, setInfoOpen] = useState(() =>
    window.matchMedia('(min-width: 1561px)').matches,
  )
  const [mobileChat, setMobileChat] = useState(false)

  const open = (id) => {
    select(id)
    setMobileChat(true)
  }

  const newCount = chats.filter((c) => c.status === 'new').length

  return (
    <div className="sp">
      <div className="sp-top">
        <div>
          <h1>Support</h1>
          <p>Foydalanuvchilarning ilova bo'yicha suhbatlari</p>
        </div>
        <div className="sp-top__right">
          {newCount > 0 && <span className="sp-top__new">{newCount} ta yangi suhbat</span>}
          <span className={`sp-conn sp-conn--${connection}`}>
            <i />
            {CONN[connection] ?? connection}
          </span>
        </div>
      </div>

      {error && (
        <div className="sp-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={reload}>
            Qayta urinish
          </button>
        </div>
      )}

      <div
        className={`sp-grid ${mobileChat ? 'is-chat' : ''} ${infoOpen && active ? 'has-info' : ''
          }`}
      >
        <ChatList chats={chats} activeId={active?.id} onSelect={open} loading={loading} />
        <ChatWindow
          key={active?.id ?? 'none'}
          chat={active}
          agents={agents}
          onSend={sendMessage}
          onClaim={claim}
          onClose={closeChat}
          onReopen={reopen}
          onTransfer={transfer}
          onLoadAgents={loadAgents}
          onLoadOlder={loadOlder}
          onRetry={retryMessage}
          onBack={() => setMobileChat(false)}
          onToggleInfo={() => setInfoOpen((v) => !v)}
          infoOpen={infoOpen}
        />
        {infoOpen && active && (
          <UserPanel chat={active} onClose={() => setInfoOpen(false)} onLoadBookings={loadBookings} />
        )}
      </div>

      {notice && (
        <div className="sp-toast" role="status">
          <span>{notice}</span>
          <button type="button" onClick={dismissNotice} aria-label="Yopish">
            ×
          </button>
        </div>
      )}
    </div>
  )
}