import { expect, test, testWithHydration } from './fixtures'

test.describe('Concurrent promise resolution (15 promises in 3 batches)', () => {
  test('all concurrent promises resolve correctly', async ({ page }) => {
    await page.goto('/concurrent')

    // Batch 1 (5 promises at 100ms)
    await expect(page.getByTestId('concurrent-1-1')).toContainText(
      'concurrent-1',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('concurrent-1-2')).toContainText(
      'concurrent-2',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('concurrent-1-3')).toContainText(
      'concurrent-3',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('concurrent-1-4')).toContainText(
      'concurrent-4',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('concurrent-1-5')).toContainText(
      'concurrent-5',
      { timeout: 5000 },
    )

    // Batch 2 (5 promises at 200ms)
    await expect(page.getByTestId('concurrent-2-1')).toContainText(
      'concurrent-1',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('concurrent-2-2')).toContainText(
      'concurrent-2',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('concurrent-2-3')).toContainText(
      'concurrent-3',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('concurrent-2-4')).toContainText(
      'concurrent-4',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('concurrent-2-5')).toContainText(
      'concurrent-5',
      { timeout: 5000 },
    )

    // Batch 3 (5 promises at 300ms)
    await expect(page.getByTestId('concurrent-3-1')).toContainText(
      'concurrent-1',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('concurrent-3-2')).toContainText(
      'concurrent-2',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('concurrent-3-3')).toContainText(
      'concurrent-3',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('concurrent-3-4')).toContainText(
      'concurrent-4',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('concurrent-3-5')).toContainText(
      'concurrent-5',
      { timeout: 5000 },
    )
  })

  test('batch 1 resolves before batch 3', async ({ page }) => {
    await page.goto('/concurrent', { waitUntil: 'commit' })

    // Batch 1 should be visible before batch 3
    await expect(page.getByTestId('concurrent-1-1')).toBeVisible({
      timeout: 3000,
    })

    // Eventually batch 3 should also be visible
    await expect(page.getByTestId('concurrent-3-5')).toBeVisible({
      timeout: 5000,
    })
  })

  testWithHydration(
    'hydration works with concurrent resolutions',
    async ({ page }) => {
      await page.goto('/concurrent')
      await page.waitForLoadState('networkidle')

      // Wait for all batches
      await expect(page.getByTestId('concurrent-3-5')).toBeVisible({
        timeout: 5000,
      })
    },
  )
})
