import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxy /nugen-api/* → https://api.nugen.in/*
      // Bypasses browser CORS — Vite's proxy runs server-side (Node.js)
      '/nugen-api': {
        target: 'https://api.nugen.in',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nugen-api/, ''),
      },
    },
  },
})

