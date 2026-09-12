import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('shared module bindings should init once', async ({ page }) => {
  await page.getByTestId('shared-singleton-link').click()

  // If module scope is duplicated between reference + split chunk, this becomes "2".
  await expect(page.getByTestId('shared-init-count')).toHaveText('1')

  // Extra signals (useful when debugging failures)
  await expect(page.getByTestId('shared-loader-saw')).toHaveText('1')
  await expect(page.getByTestId('shared-created-at-loader')).toHaveText('1')
  await expect(page.getByTestId('shared-created-at-module')).toHaveText('1')
})
