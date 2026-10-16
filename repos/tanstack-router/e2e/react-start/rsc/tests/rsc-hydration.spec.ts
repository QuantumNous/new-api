import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Hydration Tests - Hydration mismatch detection', () => {
  test('Page loads with hydration status visible', async ({ page }) => {
    await page.goto('/rsc-hydration')
    await page.waitForURL('/rsc-hydration')

    // Verify page title
    await expect(page.getByTestId('rsc-hydration-title')).toHaveText(
      'User Profile - RSC Hydration Test',
    )

    // Verify hydration status is visible
    await expect(page.getByTestId('hydration-status')).toBeVisible()
  })

  test('Hydration succeeds without mismatches', async ({ page }) => {
    await page.goto('/rsc-hydration')
    await page.waitForURL('/rsc-hydration')

    // Wait for hydration check to complete
    await expect(page.getByTestId('hydration-result')).toHaveText(
      'Hydration Successful',
    )

    // Verify hydration succeeded
    await expect(page.getByTestId('hydration-result')).toHaveText(
      'Hydration Successful',
    )

    // Verify success message is shown
    await expect(page.getByTestId('hydration-success-message')).toBeVisible()
    await expect(page.getByTestId('hydration-success-message')).toContainText(
      'RSC content matched between server and client',
    )
  })

  test('Timing info displays correctly', async ({ page }) => {
    await page.goto('/rsc-hydration')
    await page.waitForURL('/rsc-hydration')

    // Verify timing info section is visible
    await expect(page.getByTestId('timing-info')).toBeVisible()

    // Verify server timestamp is present
    const serverTime = await page.getByTestId('server-time').textContent()
    expect(serverTime).toBeTruthy()
    expect(Number(serverTime)).toBeGreaterThan(0)

    // Verify client timestamp is present
    const clientTime = await page.getByTestId('client-time').textContent()
    expect(clientTime).toBeTruthy()
    expect(Number(clientTime)).toBeGreaterThan(0)

    // Verify time difference is calculated
    const timeDiff = await page.getByTestId('time-diff').textContent()
    expect(timeDiff).toBeTruthy()
    expect(timeDiff).toMatch(/\d+ms/)
  })

  test('Server timestamp is earlier than client timestamp', async ({
    page,
  }) => {
    await page.goto('/rsc-hydration')
    await page.waitForURL('/rsc-hydration')

    // Get both timestamps
    const serverTime = await page.getByTestId('server-time').textContent()
    const clientTime = await page.getByTestId('client-time').textContent()

    // Server time should be less than or equal to client time
    // (server renders first, then client hydrates)
    expect(Number(serverTime)).toBeLessThanOrEqual(Number(clientTime))
  })

  test('Loader timestamp is present in hidden span', async ({ page }) => {
    await page.goto('/rsc-hydration')
    await page.waitForURL('/rsc-hydration')

    // Verify hidden loader timestamp
    const loaderTimestamp = await page
      .getByTestId('loader-timestamp')
      .textContent()
    expect(loaderTimestamp).toBeTruthy()
    expect(Number(loaderTimestamp)).toBeGreaterThan(0)
  })

  test('Hydration status transitions from checking to success', async ({
    page,
  }) => {
    await page.goto('/rsc-hydration')
    await page.waitForURL('/rsc-hydration')

    // Initially might show "Checking Hydration..." or quickly transition to success
    // We just need to verify it eventually shows success
    await expect(page.getByTestId('hydration-result')).toHaveText(
      'Hydration Successful',
    )
  })

  test('Page works correctly after client-side navigation', async ({
    page,
  }) => {
    // Start at home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to hydration page via nav
    await page.getByTestId('nav-hydration').click()
    await page.waitForURL('/rsc-hydration')

    // Wait for hydration check
    // Verify hydration succeeded
    await expect(page.getByTestId('hydration-result')).toHaveText(
      'Hydration Successful',
    )
  })

  test('Full page reload maintains hydration success', async ({ page }) => {
    await page.goto('/rsc-hydration')
    await page.waitForURL('/rsc-hydration')

    // Verify initial success
    await expect(page.getByTestId('hydration-result')).toHaveText(
      'Hydration Successful',
    )

    // Reload page
    await page.reload()
    await page.waitForURL('/rsc-hydration')

    // Verify still successful after reload
    await expect(page.getByTestId('hydration-result')).toHaveText(
      'Hydration Successful',
    )
  })
})
