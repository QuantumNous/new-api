import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Standalone test config (kept separate from vite.config.ts so the production `vite build` is
// untouched). Reused by later frontend phases — add new `*.test.tsx` files under src/.
export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ["./src/test-setup.ts"],
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
