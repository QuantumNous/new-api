import { defineConfig } from '@playwright/test'

const PORT = 4201
const baseURL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e/app/test',
  use: {
    baseURL,
  },
  webServer: {
    command: `pnpm exec ng serve --host 127.0.0.1 --port ${PORT} --configuration development`,
    url: `${baseURL}/scroll`,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
  },
})
