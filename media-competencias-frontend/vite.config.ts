import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // O tu plugin actual de React
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
})