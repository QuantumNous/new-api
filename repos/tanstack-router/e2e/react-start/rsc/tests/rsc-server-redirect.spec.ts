import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Server Redirect Tests', () => {
  test('SSR follows route redirect when a server function throws redirect', async ({
    page,
  }) => {
    const response = await page.goto('/rsc-server-redirect')
    await page.waitForURL('/rsc-basic')

    expect(response?.status()).toBe(200)
    await expect(page.getByTestId('rsc-basic-content')).toBeVisible()
  })

  test('client navigation follows route redirect when a server function throws redirect', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    await page.getByTestId('nav-server-redirect').click()
    await page.waitForURL('/rsc-basic')

    await expect(page.getByTestId('rsc-basic-content')).toBeVisible()
  })
})
