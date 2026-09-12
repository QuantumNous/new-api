import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Stream Readable Tests - Streaming RSCs via ReadableStream', () => {
  test('Page loads with empty state and controls visible', async ({ page }) => {
    await page.goto('/rsc-stream-readable')
    await page.waitForURL('/rsc-stream-readable')

    // Verify page title
    await expect(page.getByTestId('rsc-stream-readable-title')).toHaveText(
      'Streaming RSCs - ReadableStream Pattern',
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
    await page.goto('/rsc-stream-readable')
    await page.waitForURL('/rsc-stream-readable')
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
    await page.goto('/rsc-stream-readable')
    await page.waitForURL('/rsc-stream-readable')
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
    await page.goto('/rsc-stream-readable')
    await page.waitForURL('/rsc-stream-readable')
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

  test('Client slots (actions) work on each streamed RSC', async ({ page }) => {
    await page.goto('/rsc-stream-readable')
    await page.waitForURL('/rsc-stream-readable')
    await waitForHydration(page)

    // Start streaming and wait for completion
    await page.getByTestId('start-stream-btn').click()
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Find and click expand button on first notification
    await expect(page.getByTestId('expand-btn-0')).toBeVisible()
    await page.getByTestId('expand-btn-0').click()

    // Verify expanded content appears
    await expect(page.getByTestId('expanded-content-0')).toBeVisible()
    await expect(page.getByTestId('expanded-content-0')).toContainText(
      'Expanded view for',
    )

    // Button text should change
    await expect(page.getByTestId('expand-btn-0')).toContainText('Collapse')

    // Click again to collapse
    await page.getByTestId('expand-btn-0').click()
    await expect(page.getByTestId('expanded-content-0')).not.toBeVisible()
    await expect(page.getByTestId('expand-btn-0')).toContainText('Expand')
  })

  test('Multiple notifications can have independent client state', async ({
    page,
  }) => {
    await page.goto('/rsc-stream-readable')
    await page.waitForURL('/rsc-stream-readable')
    await waitForHydration(page)

    // Start streaming and wait for completion
    await page.getByTestId('start-stream-btn').click()
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Expand first and third notifications
    await page.getByTestId('expand-btn-0').click()
    await page.getByTestId('expand-btn-2').click()

    // Verify independent state
    await expect(page.getByTestId('expanded-content-0')).toBeVisible()
    await expect(page.getByTestId('expanded-content-2')).toBeVisible()

    // Second should still be collapsed
    await expect(page.getByTestId('expanded-content-1')).not.toBeVisible()

    // Collapse first, third should remain expanded
    await page.getByTestId('expand-btn-0').click()
    await expect(page.getByTestId('expanded-content-0')).not.toBeVisible()
    await expect(page.getByTestId('expanded-content-2')).toBeVisible()
  })

  test('Can restart streaming after completion', async ({ page }) => {
    await page.goto('/rsc-stream-readable')
    await page.waitForURL('/rsc-stream-readable')
    await waitForHydration(page)

    // First stream
    await page.getByTestId('start-stream-btn').click()
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

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

    // Should have 7 new notifications (previous ones cleared)
    await expect(page.getByTestId('final-count')).toContainText(
      'Received 7 notifications',
    )
  })
})
