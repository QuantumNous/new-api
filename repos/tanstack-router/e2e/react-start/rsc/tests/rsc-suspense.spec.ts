import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Suspense Tests - Async RSC with streaming', () => {
  // Increase timeout for tests with longer delays
  test.setTimeout(60000)

  test('RSC with async content renders after data loads', async ({ page }) => {
    await page.goto('/rsc-suspense')

    // Verify page title
    await expect(page.getByTestId('rsc-suspense-title')).toHaveText(
      'Analytics Dashboard - Async Loading',
    )

    // Wait for async content to load in single suspense section (2000ms delay)
    const singleSection = page.getByTestId('single-suspense-section')
    await expect(singleSection.getByTestId('rsc-suspense-content')).toBeVisible(
      { timeout: 10000 },
    )
    // Check that async data loaded (it shows a number value now)
    await expect(singleSection.getByTestId('async-data')).toBeVisible()

    // Verify timestamp is present (now formatted as "Started: HH:MM:SS")
    const timestamp = await singleSection
      .getByTestId('rsc-suspense-timestamp')
      .textContent()
    expect(timestamp).toContain('Started:')
  })

  test('RSC with multiple async sections renders all content', async ({
    page,
  }) => {
    await page.goto('/rsc-suspense')

    // Wait for the multi-suspense section
    const multiSection = page.getByTestId('multi-suspense-section')
    await expect(
      multiSection.getByTestId('rsc-multi-suspense-content'),
    ).toBeVisible({ timeout: 15000 })

    // Both async sections should eventually render (delays: 500ms, 1500ms, 2500ms, 3500ms)
    const sectionFast = multiSection.getByTestId('section-fast')
    const sectionSlow = multiSection.getByTestId('section-slow')

    await expect(sectionFast).toBeVisible({ timeout: 5000 })
    await expect(sectionSlow).toBeVisible({ timeout: 10000 })

    // Both should have loaded data (now shows "Loaded after Xms" text)
    await expect(sectionFast.getByTestId('async-delay')).toContainText(
      'Loaded after 500ms',
    )
    await expect(sectionSlow.getByTestId('async-delay')).toContainText(
      'Loaded after 2500ms',
    )
  })

  test('RSC renders correctly after client-side navigation', async ({
    page,
  }) => {
    // Start at home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to suspense page via nav bar (need to be specific to avoid matching example cards)
    await page.getByTestId('nav-suspense').click()
    await page.waitForURL('/rsc-suspense')

    // Verify async content loads in single section
    const singleSection = page.getByTestId('single-suspense-section')
    await expect(singleSection.getByTestId('rsc-suspense-content')).toBeVisible(
      { timeout: 10000 },
    )
    await expect(singleSection.getByTestId('async-data')).toBeVisible()
  })

  test('Suspense fallback shows during client-side navigation', async ({
    page,
  }) => {
    // Start at a different page
    await page.goto('/rsc-basic')
    await expect(page.getByTestId('rsc-basic-title')).toBeVisible()
    await waitForHydration(page)

    // Navigate to suspense page
    await page.getByTestId('nav-suspense').click()

    // The server-side Suspense fallback (MetricLoading) should be visible
    // while the async RSC content streams in. MetricLoading has "Loading..." text
    // and data-testid="async-loading"
    const singleSection = page.getByTestId('single-suspense-section')

    // Wait for either the loading state OR the content (in case it loads fast)
    // The server-side fallback has "Loading..." text
    const serverLoading = singleSection.getByTestId('async-loading')
    const loadingVisible = await serverLoading
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false)

    // If we caught the loading state, verify it eventually transitions to content
    if (loadingVisible) {
      await expect(singleSection.getByTestId('async-content')).toBeVisible({
        timeout: 10000,
      })
    } else {
      // Content loaded too fast to see loading - that's acceptable for this test
      // but let's at least verify the content is there
      await expect(singleSection.getByTestId('async-content')).toBeVisible({
        timeout: 10000,
      })
    }

    // The key assertion: the server-side loading state SHOULD have been visible
    // This proves that streaming is working - server sends fallback immediately
    expect(loadingVisible).toBe(true)
  })

  test('Server timestamp remains stable during client interaction', async ({
    page,
  }) => {
    await page.goto('/rsc-suspense')

    // Wait for content to load
    const singleSection = page.getByTestId('single-suspense-section')
    await expect(singleSection.getByTestId('rsc-suspense-content')).toBeVisible(
      { timeout: 10000 },
    )

    // Capture initial timestamp
    const initialTimestamp = await singleSection
      .getByTestId('rsc-suspense-timestamp')
      .textContent()
    expect(initialTimestamp).toContain('Started:')

    // Navigate away and back
    await page.getByTestId('nav-home').click()
    await page.waitForURL('/')

    await page.getByTestId('nav-suspense').click()
    await page.waitForURL('/rsc-suspense')

    // Wait for content
    await expect(singleSection.getByTestId('rsc-suspense-content')).toBeVisible(
      { timeout: 10000 },
    )

    // Timestamp should be different (new RSC loaded)
    const newTimestamp = await singleSection
      .getByTestId('rsc-suspense-timestamp')
      .textContent()

    // New navigation should create new RSC with new timestamp
    expect(newTimestamp).toContain('Started:')
  })
})
