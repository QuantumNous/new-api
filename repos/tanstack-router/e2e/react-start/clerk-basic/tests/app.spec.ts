import { test } from '@playwright/test'

test('loads', async ({ page }) => {
  await page.goto('/')
})
