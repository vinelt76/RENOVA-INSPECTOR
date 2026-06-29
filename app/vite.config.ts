import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // En GitHub Pages el repo vive en /RENOVA-INSPECTOR/
  base: process.env.VITE_BASE ?? '/',
})
