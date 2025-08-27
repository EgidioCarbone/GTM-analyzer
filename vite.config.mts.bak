// vite.config.ts  ← unico file di config nella root
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';          // usa namespace 'node:' con ESM

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
});