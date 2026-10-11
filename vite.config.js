import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://assessing-michelle-pharmaceutical-snapshot.trycloudflare.com',
        changeOrigin: true,
        secure: false,
      },
      '/accounts': {
        target: 'https://assessing-michelle-pharmaceutical-snapshot.trycloudflare.com',
        changeOrigin: true,
        secure: false,
      },
      // Django Channels: /ws/support/<ticket_id>/<audience>/
      '/ws': {
        target: 'https://assessing-michelle-pharmaceutical-snapshot.trycloudflare.com',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
})