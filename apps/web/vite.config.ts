import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: {
      "/api": {
        target: process.env.API_PUBLIC_URL ?? "http://localhost:3000",
        changeOrigin: true
      }
    }
  },
  build: { sourcemap: false }
});
