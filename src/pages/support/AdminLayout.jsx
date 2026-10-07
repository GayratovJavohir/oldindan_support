import { IconBox, IconChart, IconChat, IconLock, IconUsers } from './components/Icons'

const NAV = [
  { label: 'Support', icon: IconChat, active: true },
  { label: 'Buyurtmalar', icon: IconBox },
  { label: 'Foydalanuvchilar', icon: IconUsers },
  { label: 'Statistika', icon: IconChart },
]

export default function AdminLayout({
  children,
  agent = { name: 'Dilshod', role: 'Support xodimi' },
}) {
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
          <span>
            <strong>{agent.name}</strong>
            <small>{agent.role}</small>
          </span>
        </div>
      </aside>

      <main className="ad-main">
        {children}
      </main>
    </div>
  )
}