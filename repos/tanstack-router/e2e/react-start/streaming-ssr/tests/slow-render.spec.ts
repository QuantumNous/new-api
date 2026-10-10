import { expect, test, testWithHydration } from './fixtures'

test.describe('Slow render (render takes longer than serialization)', () => {
  test('all data eventually renders with server source', async ({ page }) => {
    await page.goto('/slow-render')
    await page.waitForLoadState('networkidle')

    // Quick data should be available with server source
    await expect(page.getByTestId('quick-data')).toContainText('Quick:')
    await expect(page.getByTestId('quick-source')).toContainText(
      'Quick data source: server',
    )
    await expect(page.getByTestId('loader-source')).toContainText(
      'Loader source: server',
    )

    // Deferred data should resolve with server source
    await expect(page.getByTestId('deferred-resolved')).toContainText(
      'Deferred resolved!',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('deferred-resolved')).toContainText(
      'source: server',
      { timeout: 5000 },
    )

    // Slow components should have rendered
    await expect(page.getByTestId('slow-component-1')).toBeVisible()
    await expect(page.getByTestId('slow-component-2')).toBeVisible()
    await expect(page.getByTestId('slow-component-3')).toBeVisible()
  })

  testWithHydration('hydration works after slow render', async ({ page }) => {
    await page.goto('/slow-render')
    await page.waitForLoadState('networkidle')

    // Wait for content and verify server source
    await expect(page.getByTestId('slow-component-1')).toBeVisible()
    await expect(page.getByTestId('loader-source')).toContainText(
      'Loader source: server',
    )
  })

  test('client-side navigation works', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate via nav link
    await page.getByRole('link', { name: 'Slow Render' }).first().click()
    await expect(page).toHaveURL('/slow-render')

    await expect(page.getByTestId('quick-data')).toBeVisible({ timeout: 10000 })
  })

  test('all data sources are server - proves SSR streaming works', async ({
    page,
  }) => {
    await page.goto('/slow-render')
    await page.waitForLoadState('networkidle')

    // Wait for deferred content
    await expect(page.getByTestId('deferred-resolved')).toBeVisible({
      timeout: 5000,
    })

    // Verify all sources are server
    await expect(page.getByTestId('quick-source')).toContainText('server')
    await expect(page.getByTestId('loader-source')).toContainText('server')
    await expect(page.getByTestId('deferred-resolved')).toContainText(
      'source: server',
    )
  })
})
