<<<<<<< HEAD
import { IconBox, IconChart, IconChat, IconLock, IconLogout, IconUsers } from './components/Icons'
import useAgentName from '../../lib/useAgentName'
=======
import { IconBox, IconChart, IconChat, IconLock, IconUsers } from './components/Icons'
>>>>>>> 101c5fa9d1643c85eb07cae0e2202472cb7f4066

const NAV = [
  { label: 'Support', icon: IconChat, active: true },
  { label: 'Buyurtmalar', icon: IconBox },
  { label: 'Foydalanuvchilar', icon: IconUsers },
  { label: 'Statistika', icon: IconChart },
]

<<<<<<< HEAD
const AGENT_ROLE = 'Support xodimi'

export default function AdminLayout({ children, onLogout }) {
  const name = useAgentName()
  const agent = { name, role: AGENT_ROLE }

=======
export default function AdminLayout({
  children,
  agent = { name: 'Dilshod', role: 'Support xodimi' },
}) {
>>>>>>> 101c5fa9d1643c85eb07cae0e2202472cb7f4066
  return (
    <div className="ad">
      <aside className="ad-side">
        <div className="ad-brand">
          <span className="ad-brand__mark">O</span>
          <span className="ad-brand__word">
            oldindan<small>admin</small>
          </span>
        </div>

        <nav className="ad-nav">
          {NAV.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              className={`ad-nav__item ${active ? 'is-active' : ''}`}
              disabled={!active}
              title={active ? '' : 'Tez orada'}
            >
              <Icon size={20} />
              <span>{label}</span>
              {!active && <IconLock size={14} className="ad-nav__lock" />}
            </button>
          ))}
        </nav>

        <div className="ad-me">
          <span className="ad-me__av">{agent.name[0]}</span>
<<<<<<< HEAD
          <span className="ad-me__info">
            <strong>{agent.name}</strong>
            <small>{agent.role}</small>
          </span>
          <button
            type="button"
            className="ad-me__logout"
            onClick={onLogout}
            aria-label="Chiqish"
            title="Chiqish"
          >
            <IconLogout size={18} />
          </button>
=======
          <span>
            <strong>{agent.name}</strong>
            <small>{agent.role}</small>
          </span>
>>>>>>> 101c5fa9d1643c85eb07cae0e2202472cb7f4066
        </div>
      </aside>

      <main className="ad-main">
        {children}
      </main>
    </div>
  )
}