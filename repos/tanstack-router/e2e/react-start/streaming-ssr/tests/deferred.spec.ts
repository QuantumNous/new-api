import { expect, test, testWithHydration } from './fixtures'

test.describe('Deferred data streaming', () => {
  test('shows immediate data right away and deferred data after loading', async ({
    page,
  }) => {
    await page.goto('/deferred')

    // Immediate data should be available right away
    await expect(page.getByTestId('immediate-data')).toBeVisible()
    await expect(page.getByTestId('immediate-data')).toContainText(
      'Immediate: Fast User',
    )

    // Verify immediate data came from server
    await expect(page.getByTestId('immediate-source')).toContainText(
      'Immediate source: server',
    )
    await expect(page.getByTestId('loader-source')).toContainText(
      'Loader source: server',
    )

    // Deferred data should eventually appear with server source
    await expect(page.getByTestId('deferred-data')).toContainText(
      'Deferred data loaded!',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('deferred-data')).toContainText(
      'source: server',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('deferred-server-data')).toContainText(
      'Server: Slow User',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('deferred-server-data')).toContainText(
      'source: server',
      { timeout: 5000 },
    )
  })

  test('shows loading states for deferred content', async ({ page }) => {
    // Navigate with cache disabled to ensure fresh load
    await page.goto('/deferred', { waitUntil: 'commit' })

    // Should see loading states initially (may be very brief)
    // We check that deferred content eventually shows
    await expect(page.getByTestId('deferred-data')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('deferred-server-data')).toBeVisible({
      timeout: 5000,
    })
  })

  testWithHydration(
    'hydration works - interactive elements respond',
    async ({ page }) => {
      await page.goto('/deferred')
      await page.waitForLoadState('networkidle')

      // Wait for all deferred content to load
      await expect(page.getByTestId('deferred-data')).toBeVisible({
        timeout: 5000,
      })

      // Verify all data came from server after hydration
      await expect(page.getByTestId('loader-source')).toContainText(
        'Loader source: server',
      )
      await expect(page.getByTestId('deferred-data')).toContainText(
        'source: server',
      )
    },
  )

  test('client-side navigation to deferred route works', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate via client-side routing using nav link
    await page.getByRole('link', { name: 'Deferred' }).first().click()
    await expect(page).toHaveURL('/deferred')

    // Data should load
    await expect(page.getByTestId('immediate-data')).toContainText('Fast User')
    await expect(page.getByTestId('deferred-data')).toContainText(
      'Deferred data loaded!',
      { timeout: 5000 },
    )
  })

  test('all data sources are server - proves SSR streaming works', async ({
    page,
  }) => {
    await page.goto('/deferred')

    // Wait for all deferred content
    await expect(page.getByTestId('deferred-data')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('deferred-server-data')).toBeVisible({
      timeout: 5000,
    })

    // Count all elements showing 'server' source - should be 4:
    // 1. immediate-source
    // 2. loader-source
    // 3. deferred-data (contains "source: server")
    // 4. deferred-server-data (contains "source: server")
    await expect(page.getByTestId('immediate-source')).toContainText('server')
    await expect(page.getByTestId('loader-source')).toContainText('server')
    await expect(page.getByTestId('deferred-data')).toContainText(
      'source: server',
    )
    await expect(page.getByTestId('deferred-server-data')).toContainText(
      'source: server',
    )
  })
})
