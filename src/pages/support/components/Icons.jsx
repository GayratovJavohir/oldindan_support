const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
function Svg({ size = 20, children, ...p }) {
  return <svg {...base} width={size} height={size} {...p}>{children}</svg>
}
export const IconChat = (p) => <Svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></Svg>
export const IconSearch = (p) => <Svg {...p}><><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></></Svg>
export const IconSend = (p) => <Svg {...p}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></Svg>
export const IconBolt = (p) => <Svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" /></Svg>
export const IconCheck = (p) => <Svg {...p}><path d="m5 12 5 5 9-10" /></Svg>
export const IconChecks = (p) => <Svg {...p}><><path d="m1.5 12.5 4.5 4.5 8-9.5" /><path d="m11 15.5 1.5 1.5 8.5-10" /></></Svg>
export const IconClock = (p) => <Svg {...p}><><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></></Svg>
export const IconBack = (p) => <Svg {...p}><path d="m15 18-6-6 6-6" /></Svg>
export const IconInfo = (p) => <Svg {...p}><><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></></Svg>
export const IconPhone = (p) => <Svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" /></Svg>
export const IconPin = (p) => <Svg {...p}><><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></></Svg>
export const IconPhone2 = (p) => <Svg {...p}><><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M11 18h2" /></></Svg>
export const IconBag = (p) => <Svg {...p}><><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></></Svg>
export const IconUsers = (p) => <Svg {...p}><><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></></Svg>
export const IconBox = (p) => <Svg {...p}><><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" /><path d="m3 7.5 9 4.5 9-4.5M12 12v9" /></></Svg>
export const IconChart = (p) => <Svg {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Svg>
export const IconLock = (p) => <Svg {...p}><><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></></Svg>
export const IconInbox = (p) => <Svg {...p}><path d="M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6l2-8Z" /></Svg>
export const IconPlus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
export const IconRefresh = (p) => <Svg {...p}><path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4" /></Svg>
export const IconBook = (p) => <Svg {...p}><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5ZM19 19v2H6" /></Svg>
export const IconClose = (p) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
