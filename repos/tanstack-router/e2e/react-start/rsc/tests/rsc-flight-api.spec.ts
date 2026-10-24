import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.describe('RSC Low-Level Flight Stream API', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/rsc-flight-api')
    await expect(page.getByTestId('rsc-flight-api-title')).toBeVisible()
  })

  test('Pattern 1: server function returns raw Flight Response', async ({
    page,
  }) => {
    // Wait for hydration - the button needs to be interactive
    const button = page.getByTestId('fetch-response-button')
    await expect(button).toBeVisible()
    await expect(button).toBeEnabled()

    // Click and verify the result area updates
    await button.click()

    // Wait for either content or error to appear
    const content = page.getByTestId('flight-response-content')
    const error = page.getByTestId('flight-response-error')
    const resultArea = page.getByTestId('flight-response-result')

    // First check if result area changed from initial state
    await expect(
      resultArea
        .locator(':scope')
        .filter({ hasNotText: 'Click button to fetch' }),
    ).toBeVisible({ timeout: 15000 })

    // Now check for content or error
    await expect(content.or(error)).toBeVisible({ timeout: 5000 })

    // Check if there's an error
    if (await error.isVisible()) {
      const errorText = await error.textContent()
      throw new Error(`Flight fetch failed: ${errorText}`)
    }

    // Verify content
    await expect(content).toContainText('SERVER FN RESPONSE')
    await expect(content).toContainText('server function returning Response')
  })

  test('Pattern 2: API route returns Flight stream decoded with createFromReadableStream', async ({
    page,
  }) => {
    // Wait for hydration
    const button = page.getByTestId('fetch-api-button')
    await expect(button).toBeVisible()
    await expect(button).toBeEnabled()

    await button.click()

    // Wait for either content or error
    const content = page.getByTestId('api-flight-content')
    const error = page.getByTestId('api-error')

    await expect(content.or(error)).toBeVisible({ timeout: 10000 })

    // Check if there's an error
    if (await error.isVisible()) {
      const errorText = await error.textContent()
      throw new Error(`API route flight fetch failed: ${errorText}`)
    }

    // Verify content
    await expect(content).toContainText('API ROUTE RSC')
    await expect(content).toContainText('API route Flight stream')
  })

  test('both patterns work independently', async ({ page }) => {
    await expect(page.getByTestId('fetch-response-button')).toBeEnabled()
    await expect(page.getByTestId('fetch-api-button')).toBeEnabled()

    // Click Pattern 1 button
    await page.getByTestId('fetch-response-button').click()
    await expect(page.getByTestId('flight-response-content')).toBeVisible({
      timeout: 10000,
    })

    // Click Pattern 2 button
    await page.getByTestId('fetch-api-button').click()
    await expect(page.getByTestId('api-flight-content')).toBeVisible({
      timeout: 10000,
    })

    // Both should be visible now
    await expect(page.getByTestId('flight-response-content')).toBeVisible()
    await expect(page.getByTestId('api-flight-content')).toBeVisible()

    // Verify different content
    await expect(page.getByTestId('flight-response-content')).toContainText(
      'SERVER FN RESPONSE',
    )
    await expect(page.getByTestId('api-flight-content')).toContainText(
      'API ROUTE RSC',
    )
  })
})
