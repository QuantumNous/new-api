import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

const HYDRATION_WAIT = 1000

test.describe('RSC Error Handling Tests - Error boundary behavior', () => {
  // Tests that don't trigger errors
  test('Page loads successfully without error param', async ({ page }) => {
    await page.goto('/rsc-error')
    await page.waitForURL(/\/rsc-error/)

    // Verify page title
    await expect(page.getByTestId('rsc-error-title')).toHaveText(
      'Error Handling - RSC Error Boundary',
    )

    // Verify error controls are visible
    await expect(page.getByTestId('error-controls')).toBeVisible()
    await expect(page.getByTestId('trigger-error-btn')).toBeVisible()

    // Verify error status shows OFF
    await expect(page.getByTestId('error-status')).toContainText(
      'Error mode: OFF',
    )

    // Verify no error boundary is shown
    await expect(page.getByTestId('error-boundary')).not.toBeVisible()
  })

  test('Error controls show trigger button and status', async ({ page }) => {
    await page.goto('/rsc-error')
    await page.waitForURL(/\/rsc-error/)

    // Verify error controls
    await expect(page.getByTestId('error-controls')).toBeVisible()
    await expect(page.getByTestId('trigger-error-btn')).toContainText(
      'Trigger Error',
    )

    // Verify error mode is OFF by default
    await expect(page.getByTestId('error-status')).toContainText('OFF')
  })

  test('Page loads with shouldError=false shows normal state', async ({
    page,
  }) => {
    await page.goto('/rsc-error?shouldError=false')
    await page.waitForURL(/\/rsc-error/)

    // Should show normal content, not error boundary
    await expect(page.getByTestId('error-controls')).toBeVisible()
    await expect(page.getByTestId('error-boundary')).not.toBeVisible()
  })

  test('Title is present', async ({ page }) => {
    await page.goto('/rsc-error')
    await page.waitForURL(/\/rsc-error/)

    await expect(page.getByTestId('rsc-error-title')).toHaveText(
      'Error Handling - RSC Error Boundary',
    )
  })

  test('Loader timestamp is present', async ({ page }) => {
    await page.goto('/rsc-error')
    await page.waitForURL(/\/rsc-error/)

    const timestamp = await page.getByTestId('loader-timestamp').textContent()
    expect(timestamp).toBeTruthy()
    const ts = Number(timestamp)
    expect(ts).toBeGreaterThan(0)
  })

  test('Full page reload works correctly', async ({ page }) => {
    await page.goto('/rsc-error')
    await page.waitForURL(/\/rsc-error/)

    // Verify page loaded
    await expect(page.getByTestId('rsc-error-title')).toBeVisible()

    // Full page reload
    await page.reload()
    await page.waitForURL(/\/rsc-error/)

    // Verify page still works after reload
    await expect(page.getByTestId('rsc-error-title')).toBeVisible()
    await expect(page.getByTestId('error-controls')).toBeVisible()
  })
})
