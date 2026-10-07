import Avatar from './Avatar'
import { IconClose, IconBag, IconPhone, IconPin, IconPhone2, IconUsers } from './Icons'

const Row = ({ icon, label, value }) => (
  <div className="sp-info__row">
    <span className="sp-info__ico">{icon}</span>
    <span className="sp-info__label">{label}</span>
    <strong>{value ?? 'Mavjud emas'}</strong>
  </div>
)

export default function UserPanel({ chat, onClose }) {
  if (!chat) return null

  // Backenddan keladigan user obyektini xavfsiz o'qish
  const user = chat.user || {
    name: chat.user_name || 'Foydalanuvchi',
    phone: chat.user_phone || '+998 -- --- -- --',
    orders: chat.user_orders || 0,
    joined: chat.user_joined || 'Nomaʼlum',
    city: chat.user_city || 'Toshkent',
    lang: chat.user_lang || 'Oʻzbekcha',
    device: chat.user_device || 'Nomaʼlum',
    os: chat.user_os || 'Nomaʼlum',
    appVersion: chat.user_app_version || '1.0.0',
  }

  const tags = chat.tags || []

  return (
    <aside className="sp-info">
      <button className="sp-iconbtn sp-info__close" onClick={onClose} aria-label="Yopish"><IconClose size={18} /></button>
      <div className="sp-info__card">
        <Avatar name={user.name} size={72} />
        <h3>{user.name}</h3>
        <a href={`tel:${user.phone.replace(/\s/g, '')}`} className="sp-info__phone"><IconPhone size={15} />{user.phone}</a>
        <div className="sp-info__tags">
          {tags.map((t) => <span key={t} className="sp-tag">{t}</span>)}
        </div>
      </div>

      <div className="sp-info__stats">
        <div><b>{user.orders ?? 0}</b><span>buyurtma</span></div>
        <div><b>{user.joined ?? '—'}</b><span>ro'yxatdan o'tgan</span></div>
      </div>

      <section className="sp-info__sec">
        <h4>Foydalanuvchi</h4>
        <Row icon={<IconPin size={16} />} label="Shahar" value={user.city} />
        <Row icon={<IconUsers size={16} />} label="Til" value={user.lang} />
        <Row icon={<IconBag size={16} />} label="Mas'ul xodim" value={chat.assignee ?? 'Biriktirilmagan'} />
      </section>

      <section className="sp-info__sec">
        <h4>Qurilma va ilova</h4>
        <Row icon={<IconPhone2 size={16} />} label="Qurilma" value={user.device} />
        <Row icon={<IconPhone2 size={16} />} label="Tizim" value={user.os} />
        <Row icon={<IconPhone2 size={16} />} label="Ilova versiyasi" value={user.appVersion} />
      </section>
    </aside>
  )
}