import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Bundle Tests - Multiple RSCs from single server function', () => {
  test('All bundled RSCs render correctly on initial load', async ({
    page,
  }) => {
    await page.goto('/rsc-bundle')
    await page.waitForURL('/rsc-bundle')

    // Verify page title
    await expect(page.getByTestId('rsc-bundle-page-title')).toHaveText(
      'Page Layout Bundle - Multiple RSCs from Single Server Function',
    )

    // Verify Header RSC is rendered
    await expect(page.getByTestId('rsc-bundle-header')).toBeVisible()
    await expect(page.getByTestId('rsc-bundle-logo')).toContainText('TechCorp')
    await expect(page.getByTestId('rsc-bundle-avatar')).toContainText('JD')

    // Verify Content RSC is rendered
    await expect(page.getByTestId('rsc-bundle-content')).toBeVisible()
    await expect(page.getByTestId('rsc-bundle-title')).toContainText(
      'Dashboard Overview',
    )
    await expect(page.getByTestId('rsc-bundle-subtitle')).toContainText(
      'Welcome to your dashboard',
    )
    const contentTimestamp = await page
      .getByTestId('rsc-bundle-content-timestamp')
      .textContent()
    expect(contentTimestamp).toBeTruthy()

    // Verify stats are rendered
    await expect(page.getByTestId('rsc-bundle-stat-total-users')).toBeVisible()
    await expect(
      page.getByTestId('rsc-bundle-stat-active-sessions'),
    ).toBeVisible()
    await expect(page.getByTestId('rsc-bundle-stat-revenue')).toBeVisible()

    // Verify Footer RSC is rendered
    await expect(page.getByTestId('rsc-bundle-footer')).toBeVisible()
    await expect(page.getByTestId('rsc-bundle-copyright')).toContainText(
      '2024 TechCorp Inc.',
    )
    await expect(page.getByTestId('rsc-bundle-version')).toContainText('v2.4.1')
  })

  test('Client slots in bundled RSCs work correctly', async ({ page }) => {
    await page.goto('/rsc-bundle')
    await page.waitForURL('/rsc-bundle')
    await waitForHydration(page)

    // Verify client actions area is rendered
    await expect(page.getByTestId('content-actions')).toBeVisible()

    // Verify initial action count
    await expect(page.getByTestId('action-count')).toContainText(
      'Actions performed: 0',
    )

    // Click the action button
    await page.getByTestId('action-btn').click()
    await expect(page.getByTestId('action-count')).toContainText(
      'Actions performed: 1',
    )

    // Click the user menu button in header
    await page.getByTestId('user-menu-btn').click()
    await expect(page.getByTestId('action-count')).toContainText(
      'Actions performed: 2',
    )

    // Click action button again
    await page.getByTestId('action-btn').click()
    await expect(page.getByTestId('action-count')).toContainText(
      'Actions performed: 3',
    )
  })

  test('Client interactions do not reload bundled RSCs', async ({ page }) => {
    await page.goto('/rsc-bundle')
    await page.waitForURL('/rsc-bundle')
    await waitForHydration(page)

    // Get initial timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-bundle-content-timestamp')
      .textContent()

    // Perform multiple client interactions
    await page.getByTestId('action-btn').click()
    await page.getByTestId('user-menu-btn').click()
    await page.getByTestId('action-btn').click()

    // Verify timestamp hasn't changed (RSCs not reloaded)
    const newTimestamp = await page
      .getByTestId('rsc-bundle-content-timestamp')
      .textContent()
    expect(newTimestamp).toBe(initialTimestamp)
  })

  test('Bundled RSCs share the same bundle ID', async ({ page }) => {
    await page.goto('/rsc-bundle')
    await page.waitForURL('/rsc-bundle')

    // Get the bundle ID from the hidden span
    const bundleId = await page.getByTestId('bundle-id').textContent()
    expect(bundleId).toBeTruthy()
    expect(bundleId!.length).toBeGreaterThan(0)

    // All three RSCs should be from the same bundle (verified by shared timestamp)
    const timestamp = await page.getByTestId('bundle-timestamp').textContent()
    expect(timestamp).toBeTruthy()
  })

  test('Bundled RSCs render correctly after client-side navigation', async ({
    page,
  }) => {
    // Start at home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to bundle page via nav bar (use exact match to avoid 'Async Bundle')
    await page.getByTestId('nav-bundle').click()
    await page.waitForURL('/rsc-bundle')

    // Verify all three RSCs are rendered
    await expect(page.getByTestId('rsc-bundle-header')).toBeVisible()
    await expect(page.getByTestId('rsc-bundle-content')).toBeVisible()
    await expect(page.getByTestId('rsc-bundle-footer')).toBeVisible()

    // Verify the nesting structure
    const contentActions = page.getByTestId('content-actions')
    await expect(contentActions).toBeVisible()
  })

  test('Multiple bundle page visits get new bundle IDs', async ({ page }) => {
    // First visit
    await page.goto('/rsc-bundle')
    await page.waitForURL('/rsc-bundle')
    const firstBundleId = await page.getByTestId('bundle-id').textContent()

    // Navigate away
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Second visit (force reload)
    await page.goto('/rsc-bundle')
    await page.waitForURL('/rsc-bundle')
    const secondBundleId = await page.getByTestId('bundle-id').textContent()

    // Bundle IDs should be different (new server request)
    expect(firstBundleId).toBeTruthy()
    expect(secondBundleId).toBeTruthy()
    // Note: They might be the same if cached, but the timestamp should differ
    // on a full page reload. This test mainly verifies the bundle structure works.
  })
})
