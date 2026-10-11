import { useState } from 'react'
import ChatList from './components/ChatList'
import ChatWindow from './components/ChatWindow'
import UserPanel from './components/UserPanel'
// ❗ default import bo'lishi kerak:
import useSupportChat from '../../hooks/useSupportChat'
import './support.css'

const CONN = {
  connected: 'Jonli ulangan',
<<<<<<< HEAD
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
    select,
    sendMessage,
    retryMessage,
    setStatus,
    reload,
    dismissNotice,
  } = useSupportChat()
=======
  connecting: 'Ulanmoqda…',
  reconnecting: 'Qayta ulanmoqda…',
}

export default function SupportPage() {
  const { chats, active, connection, select, sendMessage, setStatus } = useSupportChat()
>>>>>>> 101c5fa9d1643c85eb07cae0e2202472cb7f4066
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
          <p>Foydalanuvchilarning ilova bo'yicha murojaatlari</p>
        </div>
        <div className="sp-top__right">
          {newCount > 0 && <span className="sp-top__new">{newCount} ta yangi murojaat</span>}
          <span className={`sp-conn sp-conn--${connection}`}>
            <i />
            {CONN[connection] ?? connection}
          </span>
        </div>
      </div>

<<<<<<< HEAD
      {error && (
        <div className="sp-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={reload}>
            Qayta urinish
          </button>
        </div>
      )}

=======
>>>>>>> 101c5fa9d1643c85eb07cae0e2202472cb7f4066
      <div
        className={`sp-grid ${mobileChat ? 'is-chat' : ''} ${infoOpen && active ? 'has-info' : ''
          }`}
      >
<<<<<<< HEAD
        <ChatList chats={chats} activeId={active?.id} onSelect={open} loading={loading} />
=======
        <ChatList chats={chats} activeId={active?.id} onSelect={open} />
>>>>>>> 101c5fa9d1643c85eb07cae0e2202472cb7f4066
        <ChatWindow
          chat={active}
          onSend={sendMessage}
          onStatus={setStatus}
<<<<<<< HEAD
          onRetry={retryMessage}
=======
>>>>>>> 101c5fa9d1643c85eb07cae0e2202472cb7f4066
          onBack={() => setMobileChat(false)}
          onToggleInfo={() => setInfoOpen((v) => !v)}
          infoOpen={infoOpen}
        />
        {infoOpen && active && <UserPanel chat={active} onClose={() => setInfoOpen(false)} />}
      </div>
<<<<<<< HEAD

      {notice && (
        <div className="sp-toast" role="status">
          <span>{notice}</span>
          <button type="button" onClick={dismissNotice} aria-label="Yopish">
            ×
          </button>
        </div>
      )}
=======
>>>>>>> 101c5fa9d1643c85eb07cae0e2202472cb7f4066
    </div>
  )
}