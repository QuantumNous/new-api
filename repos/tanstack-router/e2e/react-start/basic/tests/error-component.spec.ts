import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { isSpaMode } from './utils/isSpaMode'

test.use({
  whitelistErrors: [
    'Failed to load resource: the server responded with a status of 500',
    'primitive beforeLoad error',
  ],
})

test('beforeLoad primitive throw renders error component on direct visit', async ({
  page,
}) => {
  const response = await page.goto('/primitive-beforeload-error')
  await page.waitForLoadState('networkidle')

  expect(response?.status()).toBe(isSpaMode ? 200 : 500)
  await expect(
    page.getByTestId('primitive-beforeload-error-component'),
  ).toHaveText('primitive beforeLoad error')
  await expect(
    page.getByTestId('primitive-beforeload-route-component'),
  ).not.toBeInViewport()
})
