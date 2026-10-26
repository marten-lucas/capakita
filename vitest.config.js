import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    // Regressions-Tests importieren 6 echte adebis-Export-ZIPs – im CI-Runner
    // grenzwertig am 5s-Default (flaky timeout, Run 40374652509)
    testTimeout: 30000,
    hookTimeout: 30000,
  },
})
