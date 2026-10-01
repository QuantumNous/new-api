import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.describe('RSC Stream Loader Tests - Streaming RSCs via loader', () => {
  test('Page loads and starts streaming automatically', async ({ page }) => {
    await page.goto('/rsc-stream-loader')
    await page.waitForURL('/rsc-stream-loader')

    // Verify page title
    await expect(page.getByTestId('rsc-stream-loader-title')).toHaveText(
      'Streaming RSCs via Loader',
    )

    // Streaming should start automatically (no button click needed)
    // Either streaming status or complete status should be visible
    await expect(
      page
        .getByTestId('streaming-status')
        .or(page.getByTestId('stream-complete')),
    ).toBeVisible({ timeout: 10000 })
  })

  test('Notifications stream in progressively without interaction', async ({
    page,
  }) => {
    await page.goto('/rsc-stream-loader')
    await page.waitForURL('/rsc-stream-loader')

    // First notifications should appear quickly
    await expect(page.getByTestId('notification-list')).toBeVisible()

    // Wait and check that notifications are accumulating
    await page.waitForTimeout(1000)
    const initialCount = await page
      .getByTestId('notification-list')
      .locator('[data-testid^="notification-notif_"]')
      .count()
    expect(initialCount).toBeGreaterThanOrEqual(1)

    // Wait for stream to complete
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Should have all 7 notifications (3 initial + 4 streamed)
    await expect(page.getByTestId('final-count')).toContainText(
      'Received 7 notifications',
    )
  })

  test('Each notification is a complete RSC with server data', async ({
    page,
  }) => {
    await page.goto('/rsc-stream-loader')
    await page.waitForURL('/rsc-stream-loader')

    // Wait for stream to complete
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Each notification should have SERVER COMPONENT badge
    // Use auto-waiting assertion to handle Suspense transitions
    const notifications = page
      .getByTestId('notification-list')
      .locator('[data-testid^="notification-notif_"]')
    await expect(notifications).toHaveCount(7, { timeout: 5000 })

    // Check first notification
    const firstNotification = notifications.first()
    await expect(firstNotification).toContainText('SERVER COMPONENT')
    await expect(firstNotification).toContainText('Notification 1')

    // Check last notification
    const lastNotification = notifications.last()
    await expect(lastNotification).toContainText('SERVER COMPONENT')
    await expect(lastNotification).toContainText('Notification 7')
  })

  test('Client slots work after streaming completes', async ({ page }) => {
    await page.goto('/rsc-stream-loader')
    await page.waitForURL('/rsc-stream-loader')

    // Wait for stream to complete
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Expand button should be visible and functional
    await expect(page.getByTestId('expand-btn-0')).toBeVisible()
    await expect(page.getByTestId('expand-btn-0')).toBeEnabled()
    await page.getByTestId('expand-btn-0').click()

    // Expanded content should appear
    await expect(page.getByTestId('expanded-content-0')).toBeVisible()
    await expect(page.getByTestId('expanded-content-0')).toContainText(
      'Expanded view for',
    )

    // Can collapse
    await page.getByTestId('expand-btn-0').click()
    await expect(page.getByTestId('expanded-content-0')).not.toBeVisible()
  })

  test('Multiple notifications have independent expand state', async ({
    page,
  }) => {
    await page.goto('/rsc-stream-loader')
    await page.waitForURL('/rsc-stream-loader')

    // Wait for stream to complete
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Expand first and third notifications
    await expect(page.getByTestId('expand-btn-0')).toBeEnabled()
    await expect(page.getByTestId('expand-btn-2')).toBeEnabled()
    await page.getByTestId('expand-btn-0').click()
    await page.getByTestId('expand-btn-2').click()

    // Both should be expanded
    await expect(page.getByTestId('expanded-content-0')).toBeVisible()
    await expect(page.getByTestId('expanded-content-2')).toBeVisible()

    // Second should not be expanded
    await expect(page.getByTestId('expanded-content-1')).not.toBeVisible()

    // Collapse first, third should remain expanded
    await page.getByTestId('expand-btn-0').click()
    await expect(page.getByTestId('expanded-content-0')).not.toBeVisible()
    await expect(page.getByTestId('expanded-content-2')).toBeVisible()
  })

  test('Loader timestamp is displayed', async ({ page }) => {
    await page.goto('/rsc-stream-loader')
    await page.waitForURL('/rsc-stream-loader')

    // Timing info should show
    await expect(page.getByTestId('timing-info')).toBeVisible()
    await expect(page.getByTestId('loader-timestamp')).toBeAttached()
  })

  test('Streaming works after client-side navigation', async ({ page }) => {
    // Start at the streaming hub page
    await page.goto('/rsc-streaming')
    await page.waitForURL('/rsc-streaming')

    // Navigate to loader streaming page via client-side navigation
    await page.getByTestId('link-rsc-stream-loader').click()
    await page.waitForURL('/rsc-stream-loader')

    // Verify page title
    await expect(page.getByTestId('rsc-stream-loader-title')).toHaveText(
      'Streaming RSCs via Loader',
    )

    // Streaming should work just like SSR
    await expect(page.getByTestId('notification-list')).toBeVisible()

    // Wait for stream to complete
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Should have all 7 notifications
    await expect(page.getByTestId('final-count')).toContainText(
      'Received 7 notifications',
    )

    // Client interactivity should work
    await expect(page.getByTestId('expand-btn-0')).toBeEnabled()
    await page.getByTestId('expand-btn-0').click()
    await expect(page.getByTestId('expanded-content-0')).toBeVisible()
  })
})
