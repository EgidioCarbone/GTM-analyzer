// vite.config.mts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

console.log("✅ Vite config caricata!");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  optimizeDeps: {
    force: true, // Forza il rebuild delle dipendenze
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@headlessui/react', 'framer-motion'],
        },
      },
    },
  },
});
