import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /api requests to  backend server
      '/api': {
        target: 'http://localhost:3001', // backend URL
        changeOrigin: true,

        
       
      },
      
    },
     headers: {
     
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'require-corp', 
    },
  },
})