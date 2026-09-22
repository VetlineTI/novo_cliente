import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Expõe o servidor para a rede local (0.0.0.0)
    proxy: {
      '/api-infosimples': {
        target: 'https://api.infosimples.com/api/v2/consultas',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-infosimples/, '')
      }
    }
  },
})

