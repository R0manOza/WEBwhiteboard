import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import 'vitest/config';

export default defineConfig({
  plugins: [react()],
   test: { // <--- Ensure this block exists
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
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