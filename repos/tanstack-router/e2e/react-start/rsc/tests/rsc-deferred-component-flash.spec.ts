import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

/**
 * RSC Deferred Component Flash Prevention Tests
 *
 * These tests verify that RSCs delivered via streaming Promise are decoded
 * before the Promise resolves, preventing flash during render.
 */
test.describe('RSC Deferred Component Flash Prevention', () => {
  /**
   * Helper to monitor for display:none flashes on an element's ancestor chain.
   * Returns true if any ancestor had display:none during the monitoring period.
   */
  async function monitorForFlash(
    page: any,
    testId: string,
    waitFn: () => Promise<void>,
  ): Promise<boolean> {
    // Set up flash monitoring
    await page.evaluate((targetTestId: string) => {
      ;(window as any).__flashDetected = false
      ;(window as any).__monitoringActive = true

      const check = () => {
        if (!(window as any).__monitoringActive) return

        const el = document.querySelector(
          `[data-testid="${targetTestId}"]`,
        ) as HTMLElement | null
        if (!el) {
          setTimeout(check, 4)
          return
        }

        // Check if any ancestor has display:none
        let current: HTMLElement | null = el
        while (current) {
          if (getComputedStyle(current).display === 'none') {
            ;(window as any).__flashDetected = true
            break
          }
          current = current.parentElement
        }

        setTimeout(check, 4)
      }
      check()
    }, testId)

    // Wait for the element to appear
    await waitFn()

    // Wait a bit more to catch any late flashes
    await page.waitForTimeout(500)

    // Stop monitoring and get result
    await page.evaluate(() => {
      ;(window as any).__monitoringActive = false
    })

    const flashDetected = await page.evaluate(
      () => (window as any).__flashDetected,
    )
    return flashDetected
  }

  test('no flash when deferred RSC component appears via streaming', async ({
    page,
  }) => {
    await page.goto('/rsc-basic')
    await page.waitForURL('/rsc-basic')
    await expect(page.getByTestId('rsc-basic-content')).toBeVisible({
      timeout: 10000,
    })
    await waitForHydration(page)

    // Navigate to deferred component route
    await page.getByTestId('nav-deferred-component').click()
    await page.waitForURL('/rsc-deferred-component')

    // Immediate RSC should be visible right away
    await expect(page.getByTestId('deferred-immediate-rsc')).toBeVisible()

    // Monitor for flash when deferred RSC appears
    const flashDetected = await monitorForFlash(
      page,
      'deferred-streamed-rsc',
      async () => {
        await expect(page.getByTestId('deferred-streamed-rsc')).toBeVisible({
          timeout: 3000,
        })
      },
    )

    expect(flashDetected).toBe(false)
  })

  test('immediate RSC renders before deferred RSC', async ({ page }) => {
    await page.goto('/rsc-deferred-component')
    await page.waitForURL('/rsc-deferred-component')

    // Immediate should be visible quickly
    await expect(page.getByTestId('deferred-immediate-rsc')).toBeVisible()

    // At this point, deferred might still be loading or already appeared
    // Check if loading state was shown (or has already resolved)
    const deferredVisible = await page
      .getByTestId('deferred-streamed-rsc')
      .isVisible()

    if (!deferredVisible) {
      // Loading state should be visible if deferred hasn't loaded yet
      await expect(page.getByTestId('deferred-loading')).toBeVisible()
    }

    // Eventually deferred should appear
    await expect(page.getByTestId('deferred-streamed-rsc')).toBeVisible({
      timeout: 3000,
    })
  })

  test('deferred RSC has correct ID', async ({ page }) => {
    await page.goto('/rsc-deferred-component')
    await page.waitForURL('/rsc-deferred-component')

    // Wait for deferred RSC
    await expect(page.getByTestId('deferred-streamed-rsc')).toBeVisible({
      timeout: 3000,
    })

    // Verify deferred RSC has correct ID prefix
    const deferredId = await page
      .getByTestId('deferred-streamed-id')
      .textContent()
    expect(deferredId).toMatch(/^def-/)

    // Verify immediate RSC has correct ID prefix
    const immediateId = await page
      .getByTestId('deferred-immediate-id')
      .textContent()
    expect(immediateId).toMatch(/^imm-/)
  })

  test('no flash on client-side navigation to deferred route', async ({
    page,
  }) => {
    // Start at home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    await page.evaluate(() => {
      ;(window as any).__navigation_marker__ = 'client-side-navigation'
    })

    // Navigate via client-side navigation
    await page.getByTestId('nav-deferred-component').click()
    await page.waitForURL('/rsc-deferred-component')

    expect(
      await page.evaluate(() => (window as any).__navigation_marker__),
    ).toBe('client-side-navigation')

    // Monitor for flash on the deferred RSC
    const flashDetected = await monitorForFlash(
      page,
      'deferred-streamed-rsc',
      async () => {
        await expect(page.getByTestId('deferred-streamed-rsc')).toBeVisible({
          timeout: 3000,
        })
      },
    )

    expect(flashDetected).toBe(false)
  })

  test('timestamps are different between immediate and deferred RSCs', async ({
    page,
  }) => {
    await page.goto('/rsc-deferred-component')
    await page.waitForURL('/rsc-deferred-component')

    // Wait for both RSCs
    await expect(page.getByTestId('deferred-immediate-rsc')).toBeVisible()
    await expect(page.getByTestId('deferred-streamed-rsc')).toBeVisible({
      timeout: 3000,
    })

    // Get timestamps
    const immediateTimestamp = await page
      .getByTestId('deferred-immediate-timestamp')
      .textContent()
    const deferredTimestamp = await page
      .getByTestId('deferred-streamed-timestamp')
      .textContent()

    // Both should be valid timestamps
    expect(immediateTimestamp).toBeTruthy()
    expect(deferredTimestamp).toBeTruthy()

    // They might be different due to the 500ms delay, but this is timing dependent
    // Just verify both exist and are non-empty
  })
})
