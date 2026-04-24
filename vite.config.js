import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/stmas-proxy': {
        target: 'https://www.stmas.bayern.de',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/stmas-proxy/, ''),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1600,
  },
})
