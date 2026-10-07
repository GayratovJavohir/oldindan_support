const pad = (n) => String(n).padStart(2, '0')

export const hhmm = (ts) => {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const startOfDay = (ts) => {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function dayLabel(ts) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000)
  if (diff === 0) return 'Bugun'
  if (diff === 1) return 'Kecha'
  const d = new Date(ts)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

export function listTime(ts) {
  const diff = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000)
  if (diff === 0) return hhmm(ts)
  if (diff === 1) return 'Kecha'
  const d = new Date(ts)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`
}

export const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()

export const STATUS = {
  new: { label: 'Yangi', tone: 'red' },
  open: { label: 'Jarayonda', tone: 'amber' },
  assigned: { label: 'Qabul qilingan', tone: 'amber' },
  in_progress: { label: 'Jarayonda', tone: 'amber' },
  pending: { label: 'Kutilmoqda', tone: 'amber' },
  resolved: { label: 'Hal qilingan', tone: 'green' },
  closed: { label: 'Yopilgan', tone: 'green' },
}