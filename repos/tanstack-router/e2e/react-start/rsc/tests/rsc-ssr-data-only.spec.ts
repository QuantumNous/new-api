import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC SSR Data-Only Tests - Loader on server, component on client', () => {
  test('Page renders with RSC content after initial load', async ({ page }) => {
    await page.goto('/rsc-ssr-data-only')
    await page.waitForURL('/rsc-ssr-data-only')

    // Wait for content to appear (component renders on client)
    await expect(page.getByTestId('rsc-ssr-data-only-content')).toBeVisible({
      timeout: 5000,
    })

    // Verify page title
    await expect(page.getByTestId('rsc-ssr-data-only-title')).toHaveText(
      'Analytics Dashboard (SSR: data-only)',
    )
  })

  test('RSC server data is visible with correct metrics', async ({ page }) => {
    await page.goto('/rsc-ssr-data-only')
    await page.waitForURL('/rsc-ssr-data-only')

    await expect(page.getByTestId('rsc-ssr-data-only-content')).toBeVisible({
      timeout: 5000,
    })

    // Verify server-rendered metrics
    await expect(page.getByTestId('rsc-report-title')).toContainText(
      'Analytics Report: Last 7 Days',
    )
    await expect(page.getByTestId('metric-visitors')).toContainText('24,583')
    await expect(page.getByTestId('metric-pageviews')).toContainText('89,421')

    // Verify server timestamp is present
    const timestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()
    expect(timestamp).toContain('Fetched:')
  })

  test('Client-rendered visualization is visible and uses browser dimensions', async ({
    page,
  }) => {
    await page.goto('/rsc-ssr-data-only')
    await page.waitForURL('/rsc-ssr-data-only')
    await expect(page.getByTestId('visualization')).toContainText(
      /Window: \d+px/,
    )

    // Verify client visualization container
    await expect(page.getByTestId('visualization')).toBeVisible()

    // Verify bar chart items are visible
    await expect(page.getByTestId('bar-google')).toBeVisible()
    await expect(page.getByTestId('bar-twitter')).toBeVisible()
    await expect(page.getByTestId('bar-direct')).toBeVisible()
    await expect(page.getByTestId('bar-linkedin')).toBeVisible()
  })

  test('Client interactivity works - selecting referrers', async ({ page }) => {
    await page.goto('/rsc-ssr-data-only')
    await page.waitForURL('/rsc-ssr-data-only')
    await expect(page.getByTestId('visualization')).toContainText(
      /Window: \d+px/,
    )

    await expect(page.getByTestId('visualization')).toBeVisible()

    // Initially no selection
    await expect(page.getByTestId('selected-referrer')).not.toBeVisible()

    // Click on Google bar
    await page.getByTestId('bar-google').click()
    await expect(page.getByTestId('selected-referrer')).toBeVisible()
    await expect(page.getByTestId('selected-referrer')).toContainText('Google')
    await expect(page.getByTestId('selected-referrer')).toContainText('12,450')

    // Click on Twitter bar
    await page.getByTestId('bar-twitter').click()
    await expect(page.getByTestId('selected-referrer')).toContainText('Twitter')
    await expect(page.getByTestId('selected-referrer')).toContainText('5,230')

    // Clear selection
    await page.getByTestId('clear-selection-btn').click()
    await expect(page.getByTestId('selected-referrer')).not.toBeVisible()
  })

  test('RSC timestamp remains stable during client interactions', async ({
    page,
  }) => {
    await page.goto('/rsc-ssr-data-only')
    await page.waitForURL('/rsc-ssr-data-only')
    await expect(page.getByTestId('visualization')).toContainText(
      /Window: \d+px/,
    )

    await expect(page.getByTestId('visualization')).toBeVisible()

    // Get initial RSC timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()

    // Perform multiple client interactions
    await page.getByTestId('bar-google').click()
    await page.getByTestId('bar-twitter').click()
    await page.getByTestId('bar-direct').click()
    await page.getByTestId('clear-selection-btn').click()
    await page.getByTestId('bar-linkedin').click()

    // Verify RSC timestamp is unchanged
    const newTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()
    expect(newTimestamp).toBe(initialTimestamp)
  })

  test('Page works correctly after client-side navigation', async ({
    page,
  }) => {
    // Start at home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to the page via nav bar
    await page.getByTestId('nav-ssr-data-only').click()
    await page.waitForURL('/rsc-ssr-data-only')

    // Verify content loads after client-side navigation
    await expect(page.getByTestId('rsc-ssr-data-only-content')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('visualization')).toBeVisible()
    await expect(page.getByTestId('bar-google')).toBeVisible()

    // Verify interactivity works
    await page.getByTestId('bar-google').click()
    await expect(page.getByTestId('selected-referrer')).toContainText('Google')
  })

  test('Client controls section is visible and functional', async ({
    page,
  }) => {
    await page.goto('/rsc-ssr-data-only')
    await page.waitForURL('/rsc-ssr-data-only')
    await expect(page.getByTestId('visualization')).toContainText(
      /Window: \d+px/,
    )

    // Verify client controls section exists
    await expect(page.getByTestId('client-controls')).toBeVisible()

    // Verify clear button works
    await page.getByTestId('bar-google').click()
    await expect(page.getByTestId('selected-referrer')).toBeVisible()
    await page.getByTestId('clear-selection-btn').click()
    await expect(page.getByTestId('selected-referrer')).not.toBeVisible()
  })

  test('Full page reload works correctly', async ({ page }) => {
    await page.goto('/rsc-ssr-data-only')
    await page.waitForURL('/rsc-ssr-data-only')
    await expect(page.getByTestId('visualization')).toContainText(
      /Window: \d+px/,
    )

    // Verify initial load
    await expect(page.getByTestId('rsc-ssr-data-only-content')).toBeVisible()

    // Make a selection
    await page.getByTestId('bar-google').click()
    await expect(page.getByTestId('selected-referrer')).toContainText('Google')

    // Reload page
    await page.reload()
    await page.waitForURL('/rsc-ssr-data-only')
    await expect(page.getByTestId('visualization')).toContainText(
      /Window: \d+px/,
    )

    // Verify content reloads (selection should be cleared after reload)
    await expect(page.getByTestId('rsc-ssr-data-only-content')).toBeVisible()
    await expect(page.getByTestId('visualization')).toBeVisible()
    await expect(page.getByTestId('selected-referrer')).not.toBeVisible()
  })

  test('All referrer bars display correct percentage values', async ({
    page,
  }) => {
    await page.goto('/rsc-ssr-data-only')
    await page.waitForURL('/rsc-ssr-data-only')
    await expect(page.getByTestId('visualization')).toContainText(
      /Window: \d+px/,
    )

    await expect(page.getByTestId('visualization')).toBeVisible()

    // Verify percentage values
    const googleBar = await page.getByTestId('bar-google').textContent()
    const twitterBar = await page.getByTestId('bar-twitter').textContent()
    const directBar = await page.getByTestId('bar-direct').textContent()
    const linkedinBar = await page.getByTestId('bar-linkedin').textContent()

    expect(googleBar).toContain('51%')
    expect(twitterBar).toContain('21%')
    expect(directBar).toContain('17%')
    expect(linkedinBar).toContain('11%')
  })
})
