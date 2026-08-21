import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Link Tests', () => {
  test('RSC renders with Link component', async ({ page }) => {
    await page.goto('/rsc-link')
    await page.waitForURL('/rsc-link')

    // Verify RSC content is rendered
    await expect(page.getByTestId('rsc-link-content')).toBeVisible()
    await expect(page.getByTestId('rsc-link-timestamp')).toBeVisible()
    // Message now contains email body text
    await expect(page.getByTestId('rsc-link-message')).toContainText(
      'Your weekly activity report is ready',
    )

    // Verify the Link is rendered correctly (now "View Full Report")
    const link = page.getByTestId('rsc-link')
    await expect(link).toBeVisible()
    await expect(link).toHaveText('View Full Report')
    await expect(link).toHaveAttribute('href', '/')
  })

  test('Link inside RSC navigates correctly on click', async ({ page }) => {
    await page.goto('/rsc-link')
    await page.waitForURL('/rsc-link')
    await waitForHydration(page)

    // Verify we're on the RSC link page
    await expect(page.getByTestId('rsc-link-title')).toBeVisible()
    await expect(page.getByTestId('rsc-link')).toBeVisible()

    // Click the link inside the RSC
    await page.getByTestId('rsc-link').click()

    // Wait for navigation to complete
    await page.waitForURL('/')

    // Verify we navigated to the home page
    await expect(page.getByTestId('home-title')).toBeVisible()
    await expect(page.getByTestId('home-title')).toHaveText(
      'React Server Components E2E Tests',
    )
  })

  test('Link inside RSC works after client-side navigation to RSC page', async ({
    page,
  }) => {
    // Start from home page
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to RSC link page via nav bar (need to be specific to avoid matching example cards)
    await page.getByTestId('nav-link').click()
    await page.waitForURL('/rsc-link')

    // Verify RSC content is rendered
    await expect(page.getByTestId('rsc-link-content')).toBeVisible()
    await expect(page.getByTestId('rsc-link')).toBeVisible()

    // Click the link inside the RSC to navigate back home
    await page.getByTestId('rsc-link').click()
    await page.waitForURL('/')

    // Verify we're back on home page
    await expect(page.getByTestId('home-title')).toBeVisible()
  })

  test('Link inside RSC performs client-side navigation (no full page reload)', async ({
    page,
  }) => {
    await page.goto('/rsc-link')
    await page.waitForURL('/rsc-link')
    await waitForHydration(page)

    // Set a marker in window to detect full page reload
    await page.evaluate(() => {
      ;(window as any).__navigation_marker__ = 'no-reload'
    })

    // Click the link inside the RSC
    await page.getByTestId('rsc-link').click()
    await page.waitForURL('/')

    // Verify the marker still exists (no full page reload occurred)
    const marker = await page.evaluate(
      () => (window as any).__navigation_marker__,
    )
    expect(marker).toBe('no-reload')

    // Verify we're on home page
    await expect(page.getByTestId('home-title')).toBeVisible()
  })
})
