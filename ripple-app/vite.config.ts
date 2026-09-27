import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split heavyweight vendor libs into their own cacheable chunks.
        // Each chunk is only downloaded when a route that uses it first loads.
        manualChunks(id) {
          // framer-motion — animation runtime used across all pages
          if (id.includes('node_modules/framer-motion')) return 'vendor-framer-motion';
          // leaflet — map library, only loaded when Map tab is opened
          if (id.includes('node_modules/leaflet')) return 'vendor-leaflet';
          // supabase client — auth & cloud storage
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase';
          // react core — shared by everything, cache-stable
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor-react';
          // react-router — routing runtime
          if (id.includes('node_modules/react-router')) return 'vendor-router';
        },
      },
    },
  },
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

