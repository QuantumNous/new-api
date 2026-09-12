import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Basic Tests', () => {
  test('RSC renders with server timestamp', async ({ page }) => {
    await page.goto('/rsc-basic')
    await page.waitForURL('/rsc-basic')

    // Verify RSC content is rendered
    await expect(page.getByTestId('rsc-basic-content')).toBeVisible()
    await expect(page.getByTestId('rsc-server-timestamp')).toBeVisible()
    await expect(page.getByTestId('rsc-label')).toContainText('Sarah Chen')

    // Verify timestamps are present
    const serverTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()
    const loaderTimestamp = await page
      .getByTestId('loader-timestamp')
      .textContent()

    expect(serverTimestamp).toContain('Fetched:')
    expect(Number(loaderTimestamp)).toBeGreaterThan(0)
  })

  test('RSC renders correctly after client-side navigation', async ({
    page,
  }) => {
    // Start from home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to RSC page via nav bar (need to be specific to avoid matching example cards)
    await page.getByTestId('nav-basic').click()
    await page.waitForURL('/rsc-basic')

    // Verify RSC content is rendered
    await expect(page.getByTestId('rsc-basic-content')).toBeVisible()
    await expect(page.getByTestId('rsc-label')).toContainText('Sarah Chen')
  })
})
