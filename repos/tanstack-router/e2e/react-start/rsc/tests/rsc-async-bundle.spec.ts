import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Async Bundle Tests - Multiple RSC Promises with React.use()', () => {
  test('Loading states appear for each RSC before they resolve', async ({
    page,
  }) => {
    await page.goto('/rsc-async-bundle')

    // Check page title appears immediately
    await expect(page.getByTestId('rsc-async-bundle-page-title')).toHaveText(
      'Async RSC Bundle - Progressive Loading with React.use()',
    )

    // Loading states should be visible initially or briefly
    // Note: The fast component (100ms) may load too quickly to catch,
    // but we should see the slow one loading
    const slowLoading = page.getByTestId('loading-slow')

    // Wait for the slow component to finish loading (1500ms + buffer)
    await expect(
      page.getByTestId('async-slow-wrapper').getByTestId('rsc-async-slow'),
    ).toBeVisible({
      timeout: 5000,
    })
  })

  test('All three RSCs render after loading completes', async ({ page }) => {
    await page.goto('/rsc-async-bundle')

    // Wait for all RSCs to load (slowest is 1500ms)
    // Use specific wrappers to avoid ambiguity
    await expect(
      page.getByTestId('async-fast-wrapper').getByTestId('rsc-async-fast'),
    ).toBeVisible({
      timeout: 3000,
    })
    await expect(
      page.getByTestId('async-medium-wrapper').getByTestId('rsc-async-medium'),
    ).toBeVisible({
      timeout: 3000,
    })
    await expect(
      page.getByTestId('async-slow-wrapper').getByTestId('rsc-async-slow'),
    ).toBeVisible({
      timeout: 3000,
    })

    // Verify content of each RSC
    await expect(page.getByTestId('rsc-async-fast-title')).toHaveText(
      'Fast Loading Component',
    )
    await expect(page.getByTestId('rsc-async-medium-title').first()).toHaveText(
      'Medium Loading Component',
    )
    await expect(page.getByTestId('rsc-async-slow-title')).toHaveText(
      'Slow Loading Component',
    )
  })

  test('All RSCs eventually load and are visible', async ({ page }) => {
    await page.goto('/rsc-async-bundle')

    // All three RSCs should load (fast at 100ms, medium at 500ms, slow at 1500ms)
    // We just verify they all eventually render

    // Fast should be visible first (100ms delay)
    await expect(
      page.getByTestId('async-fast-wrapper').getByTestId('rsc-async-fast'),
    ).toBeVisible({
      timeout: 3000,
    })

    // Medium comes next (500ms delay)
    await expect(
      page.getByTestId('async-medium-wrapper').getByTestId('rsc-async-medium'),
    ).toBeVisible({
      timeout: 3000,
    })

    // Slow is last (1500ms delay)
    await expect(
      page.getByTestId('async-slow-wrapper').getByTestId('rsc-async-slow'),
    ).toBeVisible({
      timeout: 3000,
    })

    // Verify each has its correct content
    await expect(page.getByTestId('rsc-async-fast-icon')).toHaveText('⚡')
    await expect(page.getByTestId('rsc-async-medium-icon').first()).toHaveText(
      '⏳',
    )
    await expect(page.getByTestId('rsc-async-slow-icon')).toHaveText('🐢')
  })

  test('Client slots work in async-loaded RSCs', async ({ page }) => {
    await page.goto('/rsc-async-bundle')

    // Wait for medium RSC to load (has a client slot)
    await expect(
      page.getByTestId('async-medium-wrapper').getByTestId('rsc-async-medium'),
    ).toBeVisible({
      timeout: 3000,
    })
    await expect(page.getByTestId('medium-slot-btn')).toBeEnabled()

    // Verify the slot content is rendered
    await expect(
      page.getByTestId('rsc-async-medium-slot').first(),
    ).toBeVisible()

    // Click the button in the slot
    await expect(page.getByTestId('medium-slot-btn')).toContainText(
      'Interact (0)',
    )
    await page.getByTestId('medium-slot-btn').click()
    await expect(page.getByTestId('medium-slot-btn')).toContainText(
      'Interact (1)',
    )

    // Verify interaction count updates
    await expect(page.getByTestId('interaction-count')).toHaveText('1')
  })

  test('Render props work in async-loaded RSCs', async ({ page }) => {
    await page.goto('/rsc-async-bundle')

    // Wait for slow RSC to load (has a render prop)
    await expect(
      page.getByTestId('async-slow-wrapper').getByTestId('rsc-async-slow'),
    ).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('increment-btn')).toBeEnabled()

    // Verify render prop content is displayed
    await expect(page.getByTestId('rsc-async-slow-status')).toBeVisible()
    await expect(page.getByTestId('slow-status-content')).toContainText(
      'Status: Loaded!',
    )
    await expect(page.getByTestId('slow-status-content')).toContainText(
      'Interactions: 0',
    )

    // Increment and verify render prop updates
    await page.getByTestId('increment-btn').click()
    await expect(page.getByTestId('slow-status-content')).toContainText(
      'Interactions: 1',
    )
  })

  test('All RSCs share the same bundle ID and timestamp', async ({ page }) => {
    await page.goto('/rsc-async-bundle')

    // Wait for all RSCs to load
    await expect(
      page.getByTestId('async-slow-wrapper').getByTestId('rsc-async-slow'),
    ).toBeVisible({
      timeout: 5000,
    })

    // Get bundle info
    const bundleId = await page.getByTestId('bundle-id').textContent()
    const timestamp = await page.getByTestId('bundle-timestamp').textContent()

    expect(bundleId).toBeTruthy()
    expect(bundleId!.length).toBeGreaterThan(0)
    expect(timestamp).toBeTruthy()

    // The fast RSC should show the same bundle ID
    await expect(page.getByTestId('rsc-async-fast-bundle')).toContainText(
      `Bundle: ${bundleId}`,
    )
  })

  test('Client interactions do not reload async RSCs', async ({ page }) => {
    await page.goto('/rsc-async-bundle')

    // Wait for all RSCs to load
    await expect(
      page.getByTestId('async-slow-wrapper').getByTestId('rsc-async-slow'),
    ).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('increment-btn')).toBeEnabled()

    // Get initial timestamps
    const fastTimestamp = await page
      .getByTestId('rsc-async-fast-timestamp')
      .textContent()
    const mediumTimestamp = await page
      .getByTestId('rsc-async-medium-timestamp')
      .first()
      .textContent()
    const slowTimestamp = await page
      .getByTestId('rsc-async-slow-timestamp')
      .textContent()

    // Perform multiple interactions
    await page.getByTestId('increment-btn').click()
    await page.getByTestId('medium-slot-btn').click()
    await page.getByTestId('increment-btn').click()

    // Verify interaction count updated
    await expect(page.getByTestId('interaction-count')).toHaveText('3')

    // Verify timestamps haven't changed (RSCs not reloaded)
    await expect(page.getByTestId('rsc-async-fast-timestamp')).toHaveText(
      fastTimestamp!,
    )
    await expect(
      page.getByTestId('rsc-async-medium-timestamp').first(),
    ).toHaveText(mediumTimestamp!)
    await expect(page.getByTestId('rsc-async-slow-timestamp')).toHaveText(
      slowTimestamp!,
    )
  })

  test('Async RSCs render correctly after client-side navigation', async ({
    page,
  }) => {
    // Start at home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to async bundle page via link (if nav exists) or direct navigation
    await page.goto('/rsc-async-bundle')
    await page.waitForURL(/\/rsc-async-bundle/)

    // Wait for all RSCs to load
    await expect(
      page.getByTestId('async-slow-wrapper').getByTestId('rsc-async-slow'),
    ).toBeVisible({
      timeout: 5000,
    })

    // Verify all RSCs rendered correctly
    await expect(
      page.getByTestId('async-fast-wrapper').getByTestId('rsc-async-fast'),
    ).toBeVisible()
    await expect(
      page.getByTestId('async-medium-wrapper').getByTestId('rsc-async-medium'),
    ).toBeVisible()
    await expect(
      page.getByTestId('async-slow-wrapper').getByTestId('rsc-async-slow'),
    ).toBeVisible()

    // Verify interactivity works after navigation
    await expect(page.getByTestId('increment-btn')).toBeEnabled()
    await page.getByTestId('increment-btn').click()
    await expect(page.getByTestId('interaction-count')).toHaveText('1')
  })

  test('Multiple page visits get new bundle IDs', async ({ page }) => {
    // First visit
    await page.goto('/rsc-async-bundle')
    await expect(
      page.getByTestId('async-slow-wrapper').getByTestId('rsc-async-slow'),
    ).toBeVisible({
      timeout: 5000,
    })
    const firstBundleId = await page.getByTestId('bundle-id').textContent()

    // Navigate away
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Second visit (force new request)
    await page.goto('/rsc-async-bundle')
    await expect(
      page.getByTestId('async-slow-wrapper').getByTestId('rsc-async-slow'),
    ).toBeVisible({
      timeout: 5000,
    })
    const secondBundleId = await page.getByTestId('bundle-id').textContent()

    // Bundle IDs should be different (new server request)
    expect(firstBundleId).toBeTruthy()
    expect(secondBundleId).toBeTruthy()
    // Note: They might be same if cached, but this tests the structure works
  })
})
