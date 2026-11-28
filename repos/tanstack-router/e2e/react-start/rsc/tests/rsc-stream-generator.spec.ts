import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Stream Generator Tests - Streaming RSCs via async generator', () => {
  test('Page loads with empty state and controls visible', async ({ page }) => {
    await page.goto('/rsc-stream-generator')
    await page.waitForURL('/rsc-stream-generator')

    // Verify page title
    await expect(page.getByTestId('rsc-stream-generator-title')).toHaveText(
      'Streaming RSCs - Async Generator Pattern',
    )

    // Verify controls are visible
    await expect(page.getByTestId('controls')).toBeVisible()
    await expect(page.getByTestId('start-stream-btn')).toBeVisible()
    await expect(page.getByTestId('start-stream-btn')).toContainText(
      'Start Streaming Notifications',
    )

    // Verify empty state is shown
    await expect(page.getByTestId('empty-state')).toBeVisible()
    await expect(page.getByTestId('empty-state')).toContainText(
      'No notifications yet',
    )
  })

  test('Clicking start button begins streaming notifications', async ({
    page,
  }) => {
    await page.goto('/rsc-stream-generator')
    await page.waitForURL('/rsc-stream-generator')
    await waitForHydration(page)

    // Start streaming
    await page.getByTestId('start-stream-btn').click()

    // Streaming status should appear
    await expect(page.getByTestId('streaming-status')).toBeVisible()
    await expect(page.getByTestId('notification-count')).toContainText(
      'notification(s)',
    )

    // Button should be disabled during streaming
    await expect(page.getByTestId('start-stream-btn')).toBeDisabled()
    await expect(page.getByTestId('start-stream-btn')).toContainText(
      'Streaming...',
    )

    // Wait for stream to complete
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Verify final count (3 initial + 4 streamed = 7 total)
    await expect(page.getByTestId('final-count')).toContainText(
      'Received 7 notifications',
    )
  })

  test('Notifications stream in progressively', async ({ page }) => {
    await page.goto('/rsc-stream-generator')
    await page.waitForURL('/rsc-stream-generator')
    await waitForHydration(page)

    // Start streaming
    await page.getByTestId('start-stream-btn').click()

    // First 3 should appear quickly (initial batch)
    await expect(page.getByTestId('notification-list')).toBeVisible()

    // Wait a bit and check that notifications are accumulating
    await page.waitForTimeout(500)
    const initialCount = await page
      .getByTestId('notification-list')
      .locator('[data-testid^="notification-notif_"]')
      .count()
    expect(initialCount).toBeGreaterThanOrEqual(3)

    // Wait for more to stream in
    await page.waitForTimeout(2000)
    const laterCount = await page
      .getByTestId('notification-list')
      .locator('[data-testid^="notification-notif_"]')
      .count()
    expect(laterCount).toBeGreaterThan(initialCount)

    // Wait for completion
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })
  })

  test('Each notification is a complete RSC with server data', async ({
    page,
  }) => {
    await page.goto('/rsc-stream-generator')
    await page.waitForURL('/rsc-stream-generator')
    await waitForHydration(page)

    // Start streaming and wait for completion
    await page.getByTestId('start-stream-btn').click()
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Each notification should have server-rendered content
    const notifications = page
      .getByTestId('notification-list')
      .locator('[data-testid^="notification-notif_"]')
    const count = await notifications.count()
    expect(count).toBe(7)

    // Verify first notification has required content
    const firstNotification = notifications.first()
    await expect(firstNotification).toContainText('SERVER COMPONENT')
    await expect(firstNotification).toContainText('Notification 1')
  })

  test('Client slots (dismiss/restore) work on each streamed RSC', async ({
    page,
  }) => {
    await page.goto('/rsc-stream-generator')
    await page.waitForURL('/rsc-stream-generator')
    await waitForHydration(page)

    // Start streaming and wait for completion
    await page.getByTestId('start-stream-btn').click()
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Find and click dismiss button on first notification
    await expect(page.getByTestId('dismiss-btn-0')).toBeVisible()
    await page.getByTestId('dismiss-btn-0').click()

    // Verify dismissed label appears
    await expect(page.getByTestId('dismissed-label-0')).toBeVisible()
    await expect(page.getByTestId('dismissed-label-0')).toContainText(
      'Dismissed',
    )

    // Wrapper should have reduced opacity (indicated by the visual state)
    const wrapper = page.getByTestId('notification-wrapper-0')
    await expect(wrapper).toBeVisible()

    // Button text should change to Restore
    await expect(page.getByTestId('dismiss-btn-0')).toContainText('Restore')

    // Click again to restore
    await page.getByTestId('dismiss-btn-0').click()
    await expect(page.getByTestId('dismissed-label-0')).not.toBeVisible()
    await expect(page.getByTestId('dismiss-btn-0')).toContainText('Dismiss')
  })

  test('Action slot receives correct notification ID from server', async ({
    page,
  }) => {
    await page.goto('/rsc-stream-generator')
    await page.waitForURL('/rsc-stream-generator')
    await waitForHydration(page)

    // Start streaming and wait for completion
    await page.getByTestId('start-stream-btn').click()
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Each action slot should show the notification ID from the server
    const actionId0 = await page.getByTestId('action-notif-id-0').textContent()
    expect(actionId0).toContain('ID: notif_')

    const actionId3 = await page.getByTestId('action-notif-id-3').textContent()
    expect(actionId3).toContain('ID: notif_')

    // IDs should be different
    expect(actionId0).not.toBe(actionId3)
  })

  test('Multiple notifications can have independent dismiss state', async ({
    page,
  }) => {
    await page.goto('/rsc-stream-generator')
    await page.waitForURL('/rsc-stream-generator')
    await waitForHydration(page)

    // Start streaming and wait for completion
    await page.getByTestId('start-stream-btn').click()
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Dismiss first and third notifications
    await page.getByTestId('dismiss-btn-0').click()
    await page.getByTestId('dismiss-btn-2').click()

    // Verify independent state
    await expect(page.getByTestId('dismissed-label-0')).toBeVisible()
    await expect(page.getByTestId('dismissed-label-2')).toBeVisible()

    // Second should not be dismissed
    await expect(page.getByTestId('dismissed-label-1')).not.toBeVisible()

    // Restore first, third should remain dismissed
    await page.getByTestId('dismiss-btn-0').click()
    await expect(page.getByTestId('dismissed-label-0')).not.toBeVisible()
    await expect(page.getByTestId('dismissed-label-2')).toBeVisible()

    // Final count should show dismissed count
    await expect(page.getByTestId('final-count')).toContainText('1 dismissed')
  })

  test('Can restart streaming after completion', async ({ page }) => {
    await page.goto('/rsc-stream-generator')
    await page.waitForURL('/rsc-stream-generator')
    await waitForHydration(page)

    // First stream
    await page.getByTestId('start-stream-btn').click()
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Dismiss a notification
    await page.getByTestId('dismiss-btn-0').click()
    await expect(page.getByTestId('dismissed-label-0')).toBeVisible()

    // Button should be enabled again
    await expect(page.getByTestId('start-stream-btn')).not.toBeDisabled()

    // Start second stream
    await page.getByTestId('start-stream-btn').click()

    // Should see streaming status again
    await expect(page.getByTestId('streaming-status')).toBeVisible()

    // Wait for completion
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // State should be reset - no dismissed notifications
    await expect(page.getByTestId('final-count')).not.toContainText('dismissed')

    // Should have 7 new notifications
    await expect(page.getByTestId('final-count')).toContainText(
      'Received 7 notifications',
    )
  })
})
