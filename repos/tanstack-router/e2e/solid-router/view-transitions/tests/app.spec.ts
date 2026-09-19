import { test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('placeholder test', async ({ page }) => {
  // This is a placeholder test
  await page.waitForLoadState('networkidle')
})
