import { expect, test, testWithHydration } from './fixtures'

test.describe('ReadableStream streaming', () => {
  testWithHydration('promise data resolves correctly', async ({ page }) => {
    await page.goto('/stream')

    // Promise should resolve
    await expect(page.getByTestId('promise-data')).toContainText(
      'promise-resolved',
      { timeout: 5000 },
    )
  })

  testWithHydration('stream chunks arrive incrementally', async ({ page }) => {
    await page.goto('/stream')

    // Wait for stream to complete
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // All chunks should be present
    await expect(page.getByTestId('stream-chunk-0')).toContainText('chunk-0')
    await expect(page.getByTestId('stream-chunk-1')).toContainText('chunk-1')
    await expect(page.getByTestId('stream-chunk-2')).toContainText('chunk-2')
    await expect(page.getByTestId('stream-chunk-3')).toContainText('chunk-3')
    await expect(page.getByTestId('stream-chunk-4')).toContainText('chunk-4')
  })

  testWithHydration(
    'client-side navigation to stream route works',
    async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Navigate via nav link
      await page.getByRole('link', { name: 'Stream' }).first().click()
      await expect(page).toHaveURL('/stream')

      // Wait for stream to complete
      await expect(page.getByTestId('stream-complete')).toBeVisible({
        timeout: 10000,
      })
    },
  )
})
