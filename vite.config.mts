import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: {
      ignored: ['**/temp-html/**']
    },
    proxy: {
      '/artifacts': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: ['crypto-js']
  },
  define: {
    global: 'globalThis',
  }
});
