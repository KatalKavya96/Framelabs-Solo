import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:5001', changeOrigin: true },
      '/socket.io': { target: 'http://127.0.0.1:5001', ws: true, changeOrigin: true }
    }
  }
})
