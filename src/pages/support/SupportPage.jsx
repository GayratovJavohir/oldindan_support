import { useState } from 'react'
import ChatList from './components/ChatList'
import ChatWindow from './components/ChatWindow'
import UserPanel from './components/UserPanel'
// ❗ default import bo'lishi kerak:
import useSupportChat from '../../hooks/useSupportChat'
import './support.css'

const CONN = {
  connected: 'Jonli ulangan',
  connecting: 'Ulanmoqda…',
  reconnecting: 'Qayta ulanmoqda…',
}

export default function SupportPage() {
  const { chats, active, connection, select, sendMessage, setStatus } = useSupportChat()
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

      <div
        className={`sp-grid ${mobileChat ? 'is-chat' : ''} ${infoOpen && active ? 'has-info' : ''
          }`}
      >
        <ChatList chats={chats} activeId={active?.id} onSelect={open} />
        <ChatWindow
          chat={active}
          onSend={sendMessage}
          onStatus={setStatus}
          onBack={() => setMobileChat(false)}
          onToggleInfo={() => setInfoOpen((v) => !v)}
          infoOpen={infoOpen}
        />
        {infoOpen && active && <UserPanel chat={active} onClose={() => setInfoOpen(false)} />}
      </div>
    </div>
  )
}