import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

/**
 * RSC Parallel Flash Prevention Tests
 *
 * These tests verify that parallel server function calls correctly scope
 * their decode promises without cross-contamination, and that RSCs
 * render without flash during client-side navigation.
 */
test.describe('RSC Parallel Flash Prevention', () => {
  /**
   * Helper to monitor for display:none flashes on an element's ancestor chain.
   * Returns true if any ancestor had display:none during the monitoring period.
   */
  async function monitorForFlash(
    page: any,
    testId: string,
    navigationFn: () => Promise<void>,
  ): Promise<boolean> {
    // Set up flash monitoring before navigation
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

    // Perform the navigation
    await navigationFn()

    // Wait for content to be visible
    await expect(page.getByTestId(testId)).toBeVisible({ timeout: 10000 })

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

  test('no flash when navigating to route with parallel RSC loading', async ({
    page,
  }) => {
    // Start at another RSC route
    await page.goto('/rsc-basic')
    await page.waitForURL('/rsc-basic')
    await expect(page.getByTestId('rsc-basic-content')).toBeVisible({
      timeout: 10000,
    })
    await waitForHydration(page)

    // Navigate to parallel route and monitor for flash
    const flashDetected = await monitorForFlash(
      page,
      'rsc-parallel-container',
      async () => {
        await page.getByTestId('nav-parallel').click()
        await page.waitForURL('/rsc-parallel')
      },
    )

    expect(flashDetected).toBe(false)

    // Verify all RSCs rendered correctly
    await expect(page.getByTestId('parallel-rsc-a')).toBeVisible()
    await expect(page.getByTestId('parallel-rsc-b')).toBeVisible()
    await expect(page.getByTestId('parallel-rsc-c')).toBeVisible()
  })

  test('parallel RSCs have correct IDs (no cross-contamination)', async ({
    page,
  }) => {
    await page.goto('/')
    await waitForHydration(page)

    await page.getByTestId('nav-parallel').click()
    await page.waitForURL('/rsc-parallel')

    // Wait for all RSCs to be visible
    await expect(page.getByTestId('parallel-rsc-a')).toBeVisible()
    await expect(page.getByTestId('parallel-rsc-b')).toBeVisible()
    await expect(page.getByTestId('parallel-rsc-c')).toBeVisible()

    // Each RSC should have its correct prefix
    const idA = await page.getByTestId('parallel-rsc-a-id').textContent()
    const idB = await page.getByTestId('parallel-rsc-b-id').textContent()
    const idC = await page.getByTestId('parallel-rsc-c-id').textContent()

    expect(idA).toMatch(/^A-/)
    expect(idB).toMatch(/^B-/)
    expect(idC).toMatch(/^C-/)

    // IDs should all be different
    expect(idA).not.toBe(idB)
    expect(idB).not.toBe(idC)
    expect(idA).not.toBe(idC)
  })

  test('no flash on individual parallel RSC elements', async ({ page }) => {
    await page.goto('/rsc-basic')
    await page.waitForURL('/rsc-basic')
    await expect(page.getByTestId('rsc-basic-content')).toBeVisible({
      timeout: 10000,
    })
    await waitForHydration(page)

    // Monitor all three RSC elements for flash
    const flashADetected = await monitorForFlash(
      page,
      'parallel-rsc-a',
      async () => {
        await page.getByTestId('nav-parallel').click()
        await page.waitForURL('/rsc-parallel')
      },
    )

    expect(flashADetected).toBe(false)

    // Navigate away and back, monitoring B
    await page.getByTestId('nav-basic').click()
    await page.waitForURL('/rsc-basic')
    await expect(page.getByTestId('rsc-basic-content')).toBeVisible()
    await waitForHydration(page)

    const flashBDetected = await monitorForFlash(
      page,
      'parallel-rsc-b',
      async () => {
        await page.getByTestId('nav-parallel').click()
        await page.waitForURL('/rsc-parallel')
      },
    )

    expect(flashBDetected).toBe(false)
  })

  test('parallel RSCs render correctly on direct navigation', async ({
    page,
  }) => {
    // Direct navigation (SSR)
    await page.goto('/rsc-parallel')
    await page.waitForURL('/rsc-parallel')

    // Verify all components rendered
    await expect(page.getByTestId('rsc-parallel-title')).toHaveText(
      'Parallel RSC Loading',
    )
    await expect(page.getByTestId('parallel-rsc-a')).toBeVisible()
    await expect(page.getByTestId('parallel-rsc-b')).toBeVisible()
    await expect(page.getByTestId('parallel-rsc-c')).toBeVisible()

    // Verify IDs are correct
    const idA = await page.getByTestId('parallel-rsc-a-id').textContent()
    const idB = await page.getByTestId('parallel-rsc-b-id').textContent()
    const idC = await page.getByTestId('parallel-rsc-c-id').textContent()

    expect(idA).toMatch(/^A-/)
    expect(idB).toMatch(/^B-/)
    expect(idC).toMatch(/^C-/)
  })
})
