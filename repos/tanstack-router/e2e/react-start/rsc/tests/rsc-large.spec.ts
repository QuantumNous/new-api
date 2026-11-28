import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.describe('RSC Large Payload Tests - Performance with large payloads', () => {
  test('Page loads with default items count', async ({ page }) => {
    await page.goto('/rsc-large')
    await page.waitForURL(/\/rsc-large/)

    // Verify page title
    await expect(page.getByTestId('rsc-large-title')).toHaveText(
      'Product Catalog - Large RSC Payload',
    )

    // Verify size controls are visible
    await expect(page.getByTestId('size-controls')).toBeVisible()

    // Verify metrics are displayed
    await expect(page.getByTestId('metric-count')).toBeVisible()
    await expect(page.getByTestId('metric-load-time')).toBeVisible()
    await expect(page.getByTestId('metric-render-time')).toBeVisible()
  })

  test('Size selector buttons are visible', async ({ page }) => {
    await page.goto('/rsc-large')
    await page.waitForURL(/\/rsc-large/)

    // Verify size selector buttons are visible
    await expect(page.getByTestId('size-10')).toBeVisible()
    await expect(page.getByTestId('size-50')).toBeVisible()
    await expect(page.getByTestId('size-100')).toBeVisible()
  })

  test('Load time metric is displayed', async ({ page }) => {
    await page.goto('/rsc-large')
    await page.waitForURL(/\/rsc-large/)

    // Verify load time is displayed
    const loadTime = await page.getByTestId('metric-load-time').textContent()
    expect(loadTime).toBeTruthy()
    expect(loadTime).toMatch(/\d+ms/)
  })

  test('Page loads with count=10 in URL', async ({ page }) => {
    await page.goto('/rsc-large?count=10')
    await page.waitForURL(/count=10/)

    // Verify page loaded with 10 items
    await expect(page.getByTestId('metric-count')).toContainText('10')
  })

  test('Page loads with count=100 in URL', async ({ page }) => {
    await page.goto('/rsc-large?count=100')
    await page.waitForURL(/count=100/)

    // Verify page loaded with 100 items
    await expect(page.getByTestId('metric-count')).toContainText('100')
  })

  test('Large payload (500 items) loads successfully', async ({ page }) => {
    // Increase timeout for large payload
    test.setTimeout(60000)

    await page.goto('/rsc-large?count=500')
    await page.waitForURL(/count=500/)

    // Verify page loaded successfully
    await expect(page.getByTestId('rsc-large-title')).toBeVisible()
    await expect(page.getByTestId('metric-count')).toContainText('500')

    // Verify load time is present
    const loadTimeText = await page
      .getByTestId('metric-load-time')
      .textContent()
    const loadTimeMs = parseInt(loadTimeText?.replace('ms', '') || '0', 10)
    expect(loadTimeMs).toBeGreaterThan(0)
  })

  test('Loader timestamp is present', async ({ page }) => {
    await page.goto('/rsc-large')
    await page.waitForURL(/\/rsc-large/)

    // Verify loader timestamp is present
    const timestamp = await page.getByTestId('loader-timestamp').textContent()
    expect(timestamp).toBeTruthy()
    const ts = Number(timestamp)
    expect(ts).toBeGreaterThan(0)
  })

  test('Size controls are visible with count in URL', async ({ page }) => {
    await page.goto('/rsc-large?count=10')
    await page.waitForURL(/count=10/)

    // Verify the size controls are rendered
    await expect(page.getByTestId('size-controls')).toBeVisible()
  })
})
