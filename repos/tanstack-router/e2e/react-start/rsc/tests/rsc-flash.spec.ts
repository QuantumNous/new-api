import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

/**
 * RSC Flash Regression Tests
 *
 * These tests verify that RSC content does not flash (pendingComponent)
 * during client-side navigation. A flash indicates that lazy client component
 * chunks weren't preloaded before the route rendered.
 *
 * Detection method: Each route's pendingComponent logs a unique message.
 * If any "[PENDING] /route-name" message is logged during client-side
 * navigation, the test fails.
 */
test.describe('RSC Flash Prevention', () => {
  test('no flash when navigating to RSC route with slots', async ({ page }) => {
    const pendingLogs: string[] = []
    page.on('console', (msg) => {
      if (msg.text().startsWith('[PENDING]')) {
        pendingLogs.push(msg.text())
      }
    })

    // Start at /rsc-tree (has slots)
    await page.goto('/rsc-tree')
    await expect(page.getByTestId('rsc-tree-content')).toBeVisible({
      timeout: 10000,
    })
    await page.waitForTimeout(300)

    // Clear logs from initial page load (expected on SSR)
    pendingLogs.length = 0

    // Navigate to /rsc-basic
    await page.getByTestId('nav-basic').click()
    await expect(page.getByTestId('rsc-basic-content')).toBeVisible({
      timeout: 10000,
    })

    // Check no flash during this navigation
    expect(pendingLogs).toEqual([])

    // Navigate back to /rsc-tree and check for flash
    pendingLogs.length = 0
    await page.getByTestId('nav-tree').click()
    await expect(page.getByTestId('rsc-tree-content')).toBeVisible({
      timeout: 10000,
    })

    expect(pendingLogs).toEqual([])
  })

  test('no flash when navigating between RSC routes without slots', async ({
    page,
  }) => {
    const pendingLogs: string[] = []
    page.on('console', (msg) => {
      if (msg.text().startsWith('[PENDING]')) {
        pendingLogs.push(msg.text())
      }
    })

    // Start at /rsc-basic
    await page.goto('/rsc-basic')
    await expect(page.getByTestId('rsc-basic-content')).toBeVisible({
      timeout: 10000,
    })
    await page.waitForTimeout(300)

    // Clear logs from initial page load
    pendingLogs.length = 0

    // Navigate to /rsc-slots
    await page.getByTestId('nav-slots').click()
    await expect(page.getByTestId('rsc-slotted-content')).toBeVisible({
      timeout: 10000,
    })

    // Check no flash
    expect(pendingLogs).toEqual([])

    // Navigate back to /rsc-basic
    pendingLogs.length = 0
    await page.getByTestId('nav-basic').click()
    await expect(page.getByTestId('rsc-basic-content')).toBeVisible({
      timeout: 10000,
    })

    expect(pendingLogs).toEqual([])
  })

  test('no flash when navigating TO rsc-slots route', async ({ page }) => {
    const pendingLogs: string[] = []
    page.on('console', (msg) => {
      if (msg.text().startsWith('[PENDING]')) {
        pendingLogs.push(msg.text())
      }
    })

    // Start at /rsc-basic
    await page.goto('/rsc-basic')
    await expect(page.getByTestId('rsc-basic-content')).toBeVisible({
      timeout: 10000,
    })
    await page.waitForTimeout(300)

    // Clear logs from initial page load
    pendingLogs.length = 0

    // Navigate TO /rsc-slots
    await page.getByTestId('nav-slots').click()
    await expect(page.getByTestId('rsc-slotted-content')).toBeVisible({
      timeout: 10000,
    })

    // Check no flash
    expect(pendingLogs).toEqual([])
  })

  test('no flash when navigating to rsc-stream-loader route', async ({
    page,
  }) => {
    const pendingLogs: string[] = []
    page.on('console', (msg) => {
      if (msg.text().startsWith('[PENDING]')) {
        pendingLogs.push(msg.text())
      }
    })

    // Start at /rsc-streaming (index for streaming examples)
    await page.goto('/rsc-streaming')
    await expect(page.getByTestId('rsc-streaming-title')).toBeVisible({
      timeout: 10000,
    })
    await page.waitForTimeout(300)

    // Clear logs from initial page load
    pendingLogs.length = 0

    // Navigate to /rsc-stream-loader via link
    await page.getByTestId('link-rsc-stream-loader').click()
    await expect(page.getByTestId('rsc-stream-loader-title')).toBeVisible({
      timeout: 10000,
    })

    // Check no flash during navigation
    // Note: The route may stream content progressively, but the pendingComponent
    // should not show during navigation itself
    expect(pendingLogs).toEqual([])
  })
})
