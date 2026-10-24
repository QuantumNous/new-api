import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.describe('RSC External API Tests - External data fetching', () => {
  test('Page loads with external data info visible', async ({ page }) => {
    await page.goto('/rsc-external')
    await page.waitForURL(/\/rsc-external/)

    // Verify page title
    await expect(page.getByTestId('rsc-external-title')).toHaveText(
      'Weather Data - RSC with External API',
    )

    // Verify external server URL is displayed
    await expect(page.getByTestId('external-server-url')).toBeVisible()
  })

  test('External server URL is displayed correctly', async ({ page }) => {
    await page.goto('/rsc-external')
    await page.waitForURL(/\/rsc-external/)

    // Verify the external server URL contains expected pattern
    const serverUrl = await page
      .getByTestId('external-server-url')
      .textContent()
    expect(serverUrl).toBeTruthy()
    // Should be localhost with a port
    expect(serverUrl).toMatch(/localhost:\d+/)
  })

  test('Loader timestamp is present', async ({ page }) => {
    await page.goto('/rsc-external')
    await page.waitForURL(/\/rsc-external/)

    // Verify timestamp is present
    const timestamp = await page.getByTestId('loader-timestamp').textContent()
    expect(timestamp).toBeTruthy()

    // It should be a valid timestamp
    const ts = Number(timestamp)
    expect(ts).toBeGreaterThan(0)
  })

  test('RSC external data component is rendered', async ({ page }) => {
    await page.goto('/rsc-external')
    await page.waitForURL(/\/rsc-external/)

    // Verify RSC external data component is rendered
    await expect(page.getByTestId('rsc-external-data')).toBeVisible()

    // Either we have a successful response or an error message
    const hasResponse = await page
      .getByTestId('rsc-external-response')
      .isVisible()
      .catch(() => false)
    const hasError = await page
      .getByTestId('rsc-external-error')
      .isVisible()
      .catch(() => false)

    expect(hasResponse || hasError).toBe(true)
  })

  test('External timestamp is present in RSC', async ({ page }) => {
    await page.goto('/rsc-external')
    await page.waitForURL(/\/rsc-external/)

    // Verify RSC timestamp is present
    await expect(page.getByTestId('rsc-external-timestamp')).toBeVisible()
  })

  test('Full page reload works correctly', async ({ page }) => {
    await page.goto('/rsc-external')
    await page.waitForURL(/\/rsc-external/)

    // Verify page loads
    await expect(page.getByTestId('rsc-external-title')).toBeVisible()

    // Full page reload
    await page.reload()
    await page.waitForURL(/\/rsc-external/)

    // Verify page still works after reload
    await expect(page.getByTestId('rsc-external-title')).toBeVisible()
    await expect(page.getByTestId('rsc-external-data')).toBeVisible()
  })
})
