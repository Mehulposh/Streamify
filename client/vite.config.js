import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// /api is proxied to the backend so the httpOnly login cookie and all requests are same-origin.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return { plugins: [react()], server: { port: 5173, proxy: { "/api": { target: env.VITE_API_TARGET || "http://localhost:3001", changeOrigin: false } } } };
});
