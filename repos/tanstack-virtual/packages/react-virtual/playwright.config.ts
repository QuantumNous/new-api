import { defineConfig } from '@playwright/test'

const PORT = Number(process.env.VITE_SERVER_PORT ?? 5173)
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e/app/test',
  use: {
    baseURL,
  },
  webServer: {
    command: `VITE_SERVER_PORT=${PORT} vite build --config e2e/app/vite.config.ts && VITE_SERVER_PORT=${PORT} vite build --config e2e/app/react-compiler-vite.config.ts && VITE_SERVER_PORT=${PORT} vite preview --config e2e/app/vite.config.ts --port ${PORT}`,
    url: `${baseURL}/scroll/`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
  },
})
