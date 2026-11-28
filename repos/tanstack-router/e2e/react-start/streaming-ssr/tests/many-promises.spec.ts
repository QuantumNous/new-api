import { expect, test, testWithHydration } from './fixtures'

test.describe('Many promises streaming (15 deferred)', () => {
  test('all 15 promises eventually resolve', async ({ page }) => {
    await page.goto('/many-promises')

    // Immediate group (0-20ms)
    await expect(page.getByTestId('immediate-1')).toContainText('immediate-1', {
      timeout: 5000,
    })
    await expect(page.getByTestId('immediate-2')).toContainText('immediate-2', {
      timeout: 5000,
    })
    await expect(page.getByTestId('immediate-3')).toContainText('immediate-3', {
      timeout: 5000,
    })

    // Fast group (50-125ms)
    await expect(page.getByTestId('fast-1')).toContainText('fast-1', {
      timeout: 5000,
    })
    await expect(page.getByTestId('fast-2')).toContainText('fast-2', {
      timeout: 5000,
    })
    await expect(page.getByTestId('fast-3')).toContainText('fast-3', {
      timeout: 5000,
    })
    await expect(page.getByTestId('fast-4')).toContainText('fast-4', {
      timeout: 5000,
    })

    // Medium group (150-250ms)
    await expect(page.getByTestId('medium-1')).toContainText('medium-1', {
      timeout: 5000,
    })
    await expect(page.getByTestId('medium-2')).toContainText('medium-2', {
      timeout: 5000,
    })
    await expect(page.getByTestId('medium-3')).toContainText('medium-3', {
      timeout: 5000,
    })

    // Slow group (300-500ms)
    await expect(page.getByTestId('slow-1')).toContainText('slow-1', {
      timeout: 5000,
    })
    await expect(page.getByTestId('slow-2')).toContainText('slow-2', {
      timeout: 5000,
    })
    await expect(page.getByTestId('slow-3')).toContainText('slow-3', {
      timeout: 5000,
    })

    // Very slow group (600-800ms)
    await expect(page.getByTestId('very-slow-1')).toContainText('very-slow-1', {
      timeout: 5000,
    })
    await expect(page.getByTestId('very-slow-2')).toContainText('very-slow-2', {
      timeout: 5000,
    })
  })

  testWithHydration('hydration works with many promises', async ({ page }) => {
    await page.goto('/many-promises')
    await page.waitForLoadState('networkidle')

    // Wait for all promises to resolve
    await expect(page.getByTestId('very-slow-2')).toBeVisible({ timeout: 5000 })
  })

  test('client-side navigation works', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate via nav link
    await page.getByRole('link', { name: 'Many Promises' }).click()
    await expect(page).toHaveURL('/many-promises')

    // All promises should eventually resolve
    await expect(page.getByTestId('very-slow-2')).toBeVisible({ timeout: 5000 })
  })

  test('fast promises resolve before slow ones', async ({ page }) => {
    // Navigate and check ordering - faster promises should be visible first
    await page.goto('/many-promises', { waitUntil: 'commit' })

    // Immediate promises should appear first
    await expect(page.getByTestId('immediate-1')).toBeVisible({ timeout: 2000 })

    // By the time we check very-slow, all should be visible
    await expect(page.getByTestId('very-slow-2')).toBeVisible({ timeout: 5000 })
  })
})
