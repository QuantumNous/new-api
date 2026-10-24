import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC React.cache Tests', () => {
  test('Page loads with React.cache test button', async ({ page }) => {
    await page.goto('/rsc-react-cache')
    await page.waitForURL('/rsc-react-cache')

    // Verify page title
    await expect(page.getByTestId('rsc-react-cache-title')).toHaveText(
      'React.cache Demo',
    )

    // Verify RSC content is rendered
    await expect(page.getByTestId('rsc-react-cache-content')).toBeVisible()

    // Verify test link is present
    await expect(page.getByTestId('test-cache-link')).toBeVisible()
  })

  test('React.cache deduplicates function calls by argument', async ({
    page,
  }) => {
    await page.goto('/rsc-react-cache')
    await page.waitForURL('/rsc-react-cache')

    // Click the test link
    await page.getByTestId('test-cache-link').click()
    await page.waitForURL(/test-cache/)

    // Verify the result matches expected pattern:
    // cacheFnCount = 2 (only 2 unique args: 'test1' and 'test2')
    // nonCacheFnCount = 3 (all 3 calls run)
    await expect(page.getByTestId('test-react-cache-result')).toHaveText(
      '(cacheFnCount = 2, nonCacheFnCount = 3)',
    )
  })

  test('Cache status shows success when working', async ({ page }) => {
    // First visit base route to reset counters
    await page.goto('/rsc-react-cache')
    await page.waitForURL('/rsc-react-cache')

    // Then navigate to test-cache
    await page.goto('/rsc-react-cache?test-cache')
    await page.waitForURL(/test-cache/)

    // Verify cache status shows success
    await expect(page.getByTestId('cache-status')).toContainText(
      'React.cache is working!',
    )

    // Verify individual counts
    await expect(page.getByTestId('cache-fn-count')).toContainText('2')
    await expect(page.getByTestId('non-cache-fn-count')).toContainText('3')
  })

  test('Cached results share the same randomValue for same args', async ({
    page,
  }) => {
    // First visit base route to reset counters
    await page.goto('/rsc-react-cache')
    await page.waitForURL('/rsc-react-cache')

    // Then navigate to test-cache
    await page.goto('/rsc-react-cache?test-cache')
    await page.waitForURL(/test-cache/)

    // Get the random values from cached results
    // Call 1 and Call 3 both use 'test1' so should have same randomValue
    const randomValue1 = await page.getByTestId('random-value-1').textContent()
    const randomValue2 = await page.getByTestId('random-value-2').textContent()
    const randomValue3 = await page.getByTestId('random-value-3').textContent()

    // Call 1 ('test1') and Call 3 ('test1') should have same randomValue
    expect(randomValue1).toBeTruthy()
    expect(randomValue1).toBe(randomValue3)

    // Call 2 ('test2') should have different randomValue
    expect(randomValue2).toBeTruthy()
    expect(randomValue2).not.toBe(randomValue1)
  })

  test('Server timestamp is present', async ({ page }) => {
    await page.goto('/rsc-react-cache')
    await page.waitForURL('/rsc-react-cache')

    await expect(page.getByTestId('rsc-server-timestamp')).toBeVisible()
    const timestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()
    expect(timestamp).toContain('Rendered:')
  })

  test('Client-side navigation to React.cache page works', async ({ page }) => {
    // Start at home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to React.cache page via nav bar
    await page.getByTestId('nav-react-cache').click()
    await page.waitForURL('/rsc-react-cache')

    // Verify page loaded correctly
    await expect(page.getByTestId('rsc-react-cache-title')).toHaveText(
      'React.cache Demo',
    )
    await expect(page.getByTestId('test-cache-link')).toBeVisible()
  })
})
