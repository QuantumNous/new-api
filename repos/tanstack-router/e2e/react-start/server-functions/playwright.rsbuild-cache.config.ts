import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: /rsbuild-cache\.spec\.ts/,
  timeout: 120_000,
  workers: 1,
  reporter: [['line']],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
