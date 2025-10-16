import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_BACKEND_TARGET || "http://localhost:4010",   // <-- PORTA BACKEND
        changeOrigin: true,
        // facoltativo ma utile per debug:
        // configure: (proxy) => {
        //   proxy.on('proxyReq', (_, req) => console.log('[VITE PROXY] →', req.url));
        //   proxy.on('proxyRes', (_, req, res) => console.log('[VITE PROXY] ←', req.url, res.statusCode));
        // }
      },
      "/live-debugger": {
        target: "http://localhost:5180",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/live-debugger/, ''),
      },
    },
  },
});
