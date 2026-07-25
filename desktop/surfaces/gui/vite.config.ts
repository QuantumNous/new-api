import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base: "./"` makes built asset URLs relative, so the bundle loads from the `tauri://`
// origin in the desktop shell (absolute `/assets` 404s there); a server-hosted build is
// unaffected. Dev runs on a fixed port (1420) with strictPort so the Tauri webview always
// loads the vite instance Tauri itself spawns (a drifting port would make the window load a
// stale/other server). `tauri.conf.json` devUrl must match this.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 1420, strictPort: true },
  // Tauri CLI looks for these; harmless for the browser build.
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_"],
});
