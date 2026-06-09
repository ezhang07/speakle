import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // if /api endpoint is ever seen from a fetch from frontend, we can proxy it to the backend server on localhost:8080.
      '/api': 'http://localhost:8080',
    },
  },
})
