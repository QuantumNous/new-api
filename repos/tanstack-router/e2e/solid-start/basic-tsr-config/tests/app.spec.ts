import { expect, test } from '@playwright/test'

test('opening the app', async ({ page }) => {
  await page.goto('/')

  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('add-button')).toContainText('Add 1 to 0?')
  await page.getByTestId('add-button').click()
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('add-button')).toContainText('Add 1 to 1?')
})
