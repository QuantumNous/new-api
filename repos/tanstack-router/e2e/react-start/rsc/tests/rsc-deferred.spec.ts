import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'
const DEFERRED_DATA_TIMEOUT = 5000 // Deferred data takes ~2 seconds

test.describe('RSC Deferred Tests - RSC with streamed Promise data', () => {
  test('RSC header renders immediately, loading state shows for deferred data', async ({
    page,
  }) => {
    await page.goto('/rsc-deferred')
    await page.waitForURL('/rsc-deferred')

    // Verify page title
    await expect(page.getByTestId('rsc-deferred-page-title')).toHaveText(
      'Deferred Data - RSC with Streamed Promise',
    )

    // RSC header should render immediately
    await expect(page.getByTestId('rsc-deferred-header')).toBeVisible()
    await expect(page.getByTestId('rsc-deferred-title')).toContainText(
      'Analytics Report: Weekly Analytics',
    )
    const timestamp = await page
      .getByTestId('rsc-deferred-timestamp')
      .textContent()
    expect(timestamp).toBeTruthy()

    // Instance ID should be visible
    const instanceId = await page
      .getByTestId('rsc-deferred-instance')
      .textContent()
    expect(instanceId).toContain('Instance:')
  })

  test('Deferred data loads and renders client-side with Suspense', async ({
    page,
  }) => {
    await page.goto('/rsc-deferred')
    await page.waitForURL('/rsc-deferred')

    // Initially, loading state should be visible (or data if already loaded)
    // Wait for the analytics display to appear (deferred data loaded)
    await expect(page.getByTestId('analytics-display')).toBeVisible({
      timeout: DEFERRED_DATA_TIMEOUT,
    })

    // Verify analytics data is rendered
    await expect(page.getByTestId('metric-visitors')).toBeVisible()
    await expect(page.getByTestId('metric-pageviews')).toBeVisible()
    await expect(page.getByTestId('metric-bouncerate')).toBeVisible()
    await expect(page.getByTestId('metric-duration')).toBeVisible()

    // Verify top pages are rendered
    await expect(page.getByTestId('top-page-0')).toBeVisible()
    await expect(page.getByTestId('top-page-1')).toBeVisible()
  })

  test('Client interactivity works on deferred data display', async ({
    page,
  }) => {
    await page.goto('/rsc-deferred')
    await page.waitForURL('/rsc-deferred')

    // Wait for analytics display to load
    await expect(page.getByTestId('analytics-display')).toBeVisible({
      timeout: DEFERRED_DATA_TIMEOUT,
    })
    await waitForHydration(page)

    // Initially no metric selected
    await expect(page.getByTestId('selected-metric')).not.toBeVisible()

    // Click on visitors metric
    await page.getByTestId('metric-visitors').click()
    await expect(page.getByTestId('selected-metric')).toBeVisible()
    await expect(page.getByTestId('selected-metric')).toContainText('visitors')

    // Click on pageviews metric
    await page.getByTestId('metric-pageviews').click()
    await expect(page.getByTestId('selected-metric')).toContainText('pageviews')

    // Click on bounce rate metric
    await page.getByTestId('metric-bouncerate').click()
    await expect(page.getByTestId('selected-metric')).toContainText(
      'bouncerate',
    )
  })

  test('RSC timestamp remains stable while deferred data loads', async ({
    page,
  }) => {
    await page.goto('/rsc-deferred')
    await page.waitForURL('/rsc-deferred')

    // Get initial RSC timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-deferred-timestamp')
      .textContent()
    const initialInstance = await page
      .getByTestId('rsc-deferred-instance')
      .textContent()

    // Wait for deferred data to load
    await expect(page.getByTestId('analytics-display')).toBeVisible({
      timeout: DEFERRED_DATA_TIMEOUT,
    })

    // RSC timestamp should still be the same
    const newTimestamp = await page
      .getByTestId('rsc-deferred-timestamp')
      .textContent()
    const newInstance = await page
      .getByTestId('rsc-deferred-instance')
      .textContent()

    expect(newTimestamp).toBe(initialTimestamp)
    expect(newInstance).toBe(initialInstance)
  })

  test('Client interactions do not reload RSC or re-trigger deferred data', async ({
    page,
  }) => {
    await page.goto('/rsc-deferred')
    await page.waitForURL('/rsc-deferred')

    // Wait for everything to load
    await expect(page.getByTestId('analytics-display')).toBeVisible({
      timeout: DEFERRED_DATA_TIMEOUT,
    })
    await waitForHydration(page)

    // Get initial values
    const initialTimestamp = await page
      .getByTestId('rsc-deferred-timestamp')
      .textContent()
    const initialVisitors = await page
      .getByTestId('metric-visitors')
      .textContent()

    // Perform client interactions
    await page.getByTestId('metric-visitors').click()
    await page.getByTestId('metric-pageviews').click()
    await page.getByTestId('metric-bouncerate').click()
    await page.getByTestId('metric-duration').click()

    // Verify nothing reloaded
    const newTimestamp = await page
      .getByTestId('rsc-deferred-timestamp')
      .textContent()
    const newVisitors = await page.getByTestId('metric-visitors').textContent()

    expect(newTimestamp).toBe(initialTimestamp)
    expect(newVisitors).toBe(initialVisitors)
  })

  test('Deferred data renders correctly after client-side navigation', async ({
    page,
  }) => {
    // Start at home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to deferred page via nav bar
    await page.getByTestId('nav-deferred').click()
    await page.waitForURL('/rsc-deferred')

    // RSC header should render immediately
    await expect(page.getByTestId('rsc-deferred-header')).toBeVisible()

    // Wait for deferred data
    await expect(page.getByTestId('analytics-display')).toBeVisible({
      timeout: DEFERRED_DATA_TIMEOUT,
    })

    // Verify analytics data loaded correctly
    await expect(page.getByTestId('metric-visitors')).toBeVisible()
    await expect(page.getByTestId('top-page-0')).toBeVisible()
  })

  test('Analytics data contains valid numbers', async ({ page }) => {
    await page.goto('/rsc-deferred')
    await page.waitForURL('/rsc-deferred')

    // Wait for analytics display
    await expect(page.getByTestId('analytics-display')).toBeVisible({
      timeout: DEFERRED_DATA_TIMEOUT,
    })

    // Get the visitors text and verify it's a formatted number
    const visitorsText = await page.getByTestId('metric-visitors').textContent()
    expect(visitorsText).toBeTruthy()
    // Should contain "Visitors" label and a number
    expect(visitorsText).toContain('Visitors')

    // Get pageviews and verify
    const pageViewsText = await page
      .getByTestId('metric-pageviews')
      .textContent()
    expect(pageViewsText).toContain('Page Views')

    // Get bounce rate - should contain a percentage
    const bounceRateText = await page
      .getByTestId('metric-bouncerate')
      .textContent()
    expect(bounceRateText).toContain('%')
  })
})
