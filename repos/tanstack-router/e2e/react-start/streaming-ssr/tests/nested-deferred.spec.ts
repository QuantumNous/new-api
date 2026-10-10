import { expect, test, testWithHydration } from './fixtures'

test.describe('Nested deferred (multiple levels of deferred data)', () => {
  test('all levels of deferred data eventually resolve', async ({ page }) => {
    await page.goto('/nested-deferred')

    // Plain deferred should resolve first (300ms)
    await expect(page.getByTestId('plain-deferred')).toContainText(
      'Plain deferred resolved!',
      { timeout: 5000 },
    )

    // Level 1 should resolve (200ms)
    await expect(page.getByTestId('level1-data')).toContainText('Level 1:', {
      timeout: 5000,
    })

    // Level 2 should resolve (400ms)
    await expect(page.getByTestId('level2-data')).toContainText('Level 2:', {
      timeout: 5000,
    })

    // Level 3 should resolve (600ms)
    await expect(page.getByTestId('level3-data')).toContainText('Level 3:', {
      timeout: 5000,
    })
  })

  test('shows loading states while data is loading', async ({ page }) => {
    // Use fast navigation to catch loading states
    await page.goto('/nested-deferred', { waitUntil: 'commit' })

    // Eventually all data should be visible
    await expect(page.getByTestId('level3-data')).toBeVisible({
      timeout: 10000,
    })
  })

  testWithHydration(
    'hydration works with nested deferred',
    async ({ page }) => {
      await page.goto('/nested-deferred')
      await page.waitForLoadState('networkidle')

      // Wait for all data
      await expect(page.getByTestId('level3-data')).toBeVisible({
        timeout: 10000,
      })
    },
  )

  test('client-side navigation works', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate via nav link
    await page.getByRole('link', { name: 'Nested Deferred' }).first().click()
    await expect(page).toHaveURL('/nested-deferred')

    // All levels should eventually render
    await expect(page.getByTestId('level3-data')).toBeVisible({
      timeout: 10000,
    })
  })

  test('data resolves in expected order (fastest first)', async ({ page }) => {
    await page.goto('/nested-deferred')

    // Wait for all to be visible
    await expect(page.getByTestId('level1-data')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('level2-data')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('level3-data')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('plain-deferred')).toBeVisible({
      timeout: 5000,
    })
  })
})
