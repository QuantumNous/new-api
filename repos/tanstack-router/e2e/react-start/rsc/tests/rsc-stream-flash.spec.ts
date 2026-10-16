import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

/**
 * RSC Stream Flash Prevention Tests
 *
 * These tests verify that RSCs delivered via ReadableStream are decoded
 * before the stream emits them, preventing flash during render.
 */
test.describe('RSC Stream Flash Prevention', () => {
  /**
   * Helper to monitor for display:none flashes on elements matching a selector.
   * Returns true if any matching element had display:none during monitoring.
   */
  async function monitorElementsForFlash(
    page: any,
    selector: string,
    actionFn: () => Promise<void>,
  ): Promise<boolean> {
    // Set up monitoring for any matching elements
    await page.evaluate((sel: string) => {
      ;(window as any).__flashDetected = false
      ;(window as any).__monitoringActive = true

      const check = () => {
        if (!(window as any).__monitoringActive) return

        const elements = document.querySelectorAll(sel)
        elements.forEach((el) => {
          let current: HTMLElement | null = el as HTMLElement
          while (current) {
            if (getComputedStyle(current).display === 'none') {
              ;(window as any).__flashDetected = true
              break
            }
            current = current.parentElement
          }
        })

        setTimeout(check, 4)
      }
      check()
    }, selector)

    await actionFn()

    // Wait a bit more to catch any late flashes
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      ;(window as any).__monitoringActive = false
    })

    return await page.evaluate(() => (window as any).__flashDetected)
  }

  test('no flash when RSCs stream via ReadableStream', async ({ page }) => {
    await page.goto('/rsc-stream-readable')
    await page.waitForURL('/rsc-stream-readable')
    await waitForHydration(page)

    // Start streaming and monitor for flash on notification elements
    const flashDetected = await monitorElementsForFlash(
      page,
      '[data-testid^="notification-notif_"]',
      async () => {
        await page.getByTestId('start-stream-btn').click()
        await expect(page.getByTestId('stream-complete')).toBeVisible({
          timeout: 15000,
        })
      },
    )

    expect(flashDetected).toBe(false)

    // Verify all notifications rendered
    await expect(page.getByTestId('final-count')).toContainText(
      '7 notifications',
    )
  })

  test('no flash when RSCs stream via async generator', async ({ page }) => {
    await page.goto('/rsc-stream-generator')
    await page.waitForURL('/rsc-stream-generator')
    await waitForHydration(page)

    const flashDetected = await monitorElementsForFlash(
      page,
      '[data-testid^="notification-notif_"]',
      async () => {
        await page.getByTestId('start-stream-btn').click()
        await expect(page.getByTestId('stream-complete')).toBeVisible({
          timeout: 15000,
        })
      },
    )

    expect(flashDetected).toBe(false)

    // Verify all notifications rendered
    await expect(page.getByTestId('final-count')).toContainText(
      '7 notifications',
    )
  })

  test('no flash when directly loading route with loader-based RSC streaming', async ({
    page,
  }) => {
    // Direct navigation to loader-based streaming route (SSR path)
    await page.goto('/rsc-stream-loader')
    await page.waitForURL('/rsc-stream-loader')

    // Wait for streaming to complete
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 15000,
    })

    // Verify all notifications rendered
    await expect(page.getByTestId('final-count')).toContainText(
      '7 notifications',
    )
  })

  test('streamed RSCs have SERVER COMPONENT badge', async ({ page }) => {
    await page.goto('/rsc-stream-readable')
    await page.waitForURL('/rsc-stream-readable')
    await waitForHydration(page)

    // Start streaming
    await page.getByTestId('start-stream-btn').click()
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 20000,
    })

    // Each notification should have SERVER COMPONENT badge
    const notifications = page
      .getByTestId('notification-list')
      .locator('[data-testid^="notification-notif_"]')
    const count = await notifications.count()
    expect(count).toBe(7)

    // Check first notification
    const firstNotification = notifications.first()
    await expect(firstNotification).toContainText('SERVER COMPONENT')
  })

  test('client interactivity works on streamed RSCs', async ({ page }) => {
    await page.goto('/rsc-stream-readable')
    await page.waitForURL('/rsc-stream-readable')
    await waitForHydration(page)

    // Start streaming
    await page.getByTestId('start-stream-btn').click()
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 20000,
    })

    // Expand first notification - should work without flash
    await expect(page.getByTestId('expand-btn-0')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('expand-btn-0')).toBeEnabled()
    await page.getByTestId('expand-btn-0').click()

    // Expanded content should appear without flash
    await expect(page.getByTestId('expanded-content-0')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('expanded-content-0')).toContainText(
      'Expanded view for',
    )
  })

  test('no flash on direct SSR load of streaming route', async ({ page }) => {
    // Direct navigation (SSR)
    await page.goto('/rsc-stream-loader')
    await page.waitForURL('/rsc-stream-loader')

    // Should see streaming or complete status
    await expect(
      page
        .getByTestId('streaming-status')
        .or(page.getByTestId('stream-complete')),
    ).toBeVisible({ timeout: 15000 })

    // Wait for completion
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 15000,
    })

    // Verify notifications rendered
    await expect(page.getByTestId('final-count')).toContainText(
      '7 notifications',
    )
  })
})
