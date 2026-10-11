# Oldindan — Support paneli

Support xodimlari uchun admin panel (React 19 + Vite). Backend: Django REST + Channels.

## Ishga tushirish

```bash
npm install
cp .env.example .env   # kerak bo'lsa
npm run dev            # http://localhost:5173
```

Dev'da `/api`, `/ws` so'rovlari `vite.config.js` orqali `http://127.0.0.1:8000` ga uzatiladi.

## Skriptlar

| Buyruq | Vazifa |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build (`dist/`) |
| `npm run lint` | ESLint |

## Tuzilma

- `src/pages/login` — kirish sahifasi
- `src/pages/support` — support paneli (ro'yxat, chat, foydalanuvchi paneli)
- `src/hooks/useSupportChat.js` — ticketlar, xabarlar, polling va WebSocket
- `src/services/supportSocket.js` — WebSocket klienti
- `src/lib` — auth (token, joriy xodim)
