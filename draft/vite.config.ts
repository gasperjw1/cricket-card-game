import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Served by the Swipe Sixer server at /draft in production (see server/src/index.ts); the data
  // loader reads import.meta.env.BASE_URL so the same build works under any prefix.
  base: "/draft/",
  plugins: [react()],
  server: {
    port: 5174,
    // The engine is imported as TypeScript source from the wcdraft workspace (relative imports);
    // only its pure modules (engine/data, engine/tournament, engine/rarity, util/csv …) are used.
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
  },
});
