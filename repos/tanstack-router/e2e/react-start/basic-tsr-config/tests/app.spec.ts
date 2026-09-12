import { expect, test } from '@playwright/test'

test('opening the app', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  const button = page.getByTestId('add-button')

  await expect(button).toContainText('Add 1 to 0?')

  await button.click()
  await page.waitForLoadState('networkidle')

  await expect(button).toContainText('Add 1 to 1?')
})
