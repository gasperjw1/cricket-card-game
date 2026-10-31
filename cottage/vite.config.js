import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/cottage/",
  server: {
    port: 5174,
    proxy: {
      "/cottage/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
