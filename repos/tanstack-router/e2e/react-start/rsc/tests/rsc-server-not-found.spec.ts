import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Server Not Found Tests', () => {
  test.use({
    whitelistErrors: [
      'Failed to load resource: the server responded with a status of 404',
    ],
  })

  test('SSR renders the route notFoundComponent when a server function throws notFound', async ({
    page,
  }) => {
    const response = await page.goto('/rsc-server-not-found')
    await page.waitForURL('/rsc-server-not-found')

    expect(response?.status()).toBe(404)

    await expect(
      page.getByTestId('rsc-server-not-found-boundary'),
    ).toBeVisible()
    await expect(page.getByTestId('rsc-server-not-found-heading')).toHaveText(
      'RSC Server Function Not Found',
    )
    await expect(
      page.getByTestId('rsc-server-not-found-message'),
    ).toContainText('server function threw `notFound()`')
  })

  test('client navigation renders the route notFoundComponent when a server function throws notFound', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    await page.getByTestId('nav-server-not-found').click()
    await page.waitForURL('/rsc-server-not-found')

    await expect(
      page.getByTestId('rsc-server-not-found-boundary'),
    ).toBeVisible()
    await expect(page.getByTestId('rsc-server-not-found-heading')).toHaveText(
      'RSC Server Function Not Found',
    )
  })
})
