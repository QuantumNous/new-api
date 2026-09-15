import { expect } from '@playwright/test'

import { test } from '@tanstack/router-e2e-utils'

test.use({
  whitelistErrors: [
    /Failed to load resource: the server responded with a status of 404/,
  ],
})
test.describe('Unicode route rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForURL('/')
  })

  test.describe('Special characters in route paths', () => {
    test('should render route with pipe character in path on direct navigation', async ({
      page,
      baseURL,
    }) => {
      await page.goto('/special|pipe')
      await page.waitForURL(`${baseURL}/special%7Cpipe`)

      await expect(
        page.getByTestId('special-pipe-route-heading'),
      ).toBeInViewport()
    })

    test('should render route with pipe character in path on router navigation', async ({
      page,
      baseURL,
    }) => {
      const pipeLink = page.getByTestId('special-pipe-link')

      await pipeLink.click()
      await page.waitForURL(`${baseURL}/special%7Cpipe`)

      await expect(
        page.getByTestId('special-pipe-route-heading'),
      ).toBeInViewport()
    })
  })
})
