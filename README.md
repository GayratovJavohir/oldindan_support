<<<<<<< HEAD
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
=======
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
>>>>>>> 101c5fa9d1643c85eb07cae0e2202472cb7f4066
