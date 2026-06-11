import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../app/static'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Separa dependencias estables en chunks propios: cachean entre deploys
        // (no se reconstruyen al cambiar código de la app) y bajan el bundle
        // principal por debajo del aviso de 500 kB.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          html2canvas: ['html2canvas'],
          qrcode: ['qrcode.react'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
