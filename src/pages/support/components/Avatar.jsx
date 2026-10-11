import { initials } from './format'

// ismga qarab doim bir xil qizil-jigarrang ohang
const hue = (s) => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 4

export default function Avatar({ name, size = 44, online }) {
  return (
    <span className={`sp-avatar sp-avatar--${hue(name)}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(name)}
      {online && <i className="sp-avatar__dot" />}
    </span>
  )
}
