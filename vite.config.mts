import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",   // <-- PORTA BACKEND
        changeOrigin: true,
        // facoltativo ma utile per debug:
        // configure: (proxy) => {
        //   proxy.on('proxyReq', (_, req) => console.log('[VITE PROXY] →', req.url));
        //   proxy.on('proxyRes', (_, req, res) => console.log('[VITE PROXY] ←', req.url, res.statusCode));
        // }
      },
    },
  },
});
