import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Context Tests - React Context interaction', () => {
  test('Page loads with context controls visible', async ({ page }) => {
    await page.goto('/rsc-context')
    await page.waitForURL('/rsc-context')

    // Verify page title
    await expect(page.getByTestId('rsc-context-title')).toHaveText(
      'User Preferences - RSC with Context',
    )

    // Verify context controls are visible
    await expect(page.getByTestId('context-controls')).toBeVisible()
    await expect(page.getByTestId('toggle-theme-btn')).toBeVisible()
    await expect(page.getByTestId('toggle-notifications-btn')).toBeVisible()

    // Verify initial theme is light
    await expect(page.getByTestId('current-theme')).toContainText(
      'Theme: light',
    )
  })

  test('Theme toggle changes context', async ({ page }) => {
    await page.goto('/rsc-context')
    await page.waitForURL('/rsc-context')
    await waitForHydration(page)

    // Verify initial theme
    await expect(page.getByTestId('current-theme')).toContainText(
      'Theme: light',
    )
    await expect(page.getByTestId('client-theme')).toContainText('light')

    // Toggle theme to dark
    await page.getByTestId('toggle-theme-btn').click()

    // Verify theme changed
    await expect(page.getByTestId('current-theme')).toContainText('Theme: dark')
    await expect(page.getByTestId('client-theme')).toContainText('dark')

    // Toggle back to light
    await page.getByTestId('toggle-theme-btn').click()

    // Verify theme changed back
    await expect(page.getByTestId('current-theme')).toContainText(
      'Theme: light',
    )
    await expect(page.getByTestId('client-theme')).toContainText('light')
  })

  test('Notifications toggle works correctly', async ({ page }) => {
    await page.goto('/rsc-context')
    await page.waitForURL('/rsc-context')
    await waitForHydration(page)

    // Verify initial notifications state is ON
    await expect(page.getByTestId('toggle-notifications-btn')).toContainText(
      'Notifications: ON',
    )
    await expect(page.getByTestId('client-notifications')).toContainText('ON')

    // Toggle notifications off
    await page.getByTestId('toggle-notifications-btn').click()

    // Verify notifications changed
    await expect(page.getByTestId('toggle-notifications-btn')).toContainText(
      'Notifications: OFF',
    )
    await expect(page.getByTestId('client-notifications')).toContainText('OFF')

    // Toggle back on
    await page.getByTestId('toggle-notifications-btn').click()

    // Verify notifications changed back
    await expect(page.getByTestId('toggle-notifications-btn')).toContainText(
      'Notifications: ON',
    )
    await expect(page.getByTestId('client-notifications')).toContainText('ON')
  })

  test('Theme changes do not refetch RSC', async ({ page }) => {
    await page.goto('/rsc-context')
    await page.waitForURL('/rsc-context')
    await waitForHydration(page)

    // Get initial timestamp
    const initialTimestamp = await page
      .getByTestId('loader-timestamp')
      .textContent()

    // Toggle theme multiple times
    await page.getByTestId('toggle-theme-btn').click()
    await expect(page.getByTestId('current-theme')).toContainText('Theme: dark')
    await page.getByTestId('toggle-theme-btn').click()
    await expect(page.getByTestId('current-theme')).toContainText(
      'Theme: light',
    )
    await page.getByTestId('toggle-theme-btn').click()
    await expect(page.getByTestId('current-theme')).toContainText('Theme: dark')

    // Verify timestamp hasn't changed (RSC not refetched)
    const newTimestamp = await page
      .getByTestId('loader-timestamp')
      .textContent()
    expect(newTimestamp).toBe(initialTimestamp)
  })

  test('Server data is displayed correctly', async ({ page }) => {
    await page.goto('/rsc-context')
    await page.waitForURL('/rsc-context')

    // Verify server data is displayed in the context consumer
    await expect(page.getByTestId('context-consumer')).toBeVisible()
    await expect(page.getByTestId('server-user-id')).toContainText('user_12345')
  })

  test('Context consumer shows both server and client data', async ({
    page,
  }) => {
    await page.goto('/rsc-context')
    await page.waitForURL('/rsc-context')
    await waitForHydration(page)

    // Verify context consumer is visible
    await expect(page.getByTestId('context-consumer')).toBeVisible()

    // Verify server data
    await expect(page.getByTestId('server-user-id')).toBeVisible()

    // Verify client data
    await expect(page.getByTestId('client-theme')).toBeVisible()
    await expect(page.getByTestId('client-notifications')).toBeVisible()

    // Toggle theme and verify client data updates
    await page.getByTestId('toggle-theme-btn').click()
    await expect(page.getByTestId('client-theme')).toContainText('dark')

    // Server data should remain unchanged
    await expect(page.getByTestId('server-user-id')).toContainText('user_12345')
  })

  test('Multiple context changes work correctly', async ({ page }) => {
    await page.goto('/rsc-context')
    await page.waitForURL('/rsc-context')
    await waitForHydration(page)

    // Change both theme and notifications
    await page.getByTestId('toggle-theme-btn').click()
    await page.getByTestId('toggle-notifications-btn').click()

    // Verify both changed
    await expect(page.getByTestId('client-theme')).toContainText('dark')
    await expect(page.getByTestId('client-notifications')).toContainText('OFF')

    // Change back
    await page.getByTestId('toggle-theme-btn').click()
    await page.getByTestId('toggle-notifications-btn').click()

    // Verify both changed back
    await expect(page.getByTestId('client-theme')).toContainText('light')
    await expect(page.getByTestId('client-notifications')).toContainText('ON')
  })
})
