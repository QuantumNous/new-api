import { expect, test } from './fixtures'

test('vite preview streams HTML incrementally', async ({ page }) => {
  // /deferred has immediate data + deferred data with a ~1s delay.
  // Without streaming, compression buffers the entire response.
  await page.goto('/deferred', { waitUntil: 'commit' })

  // Immediate data should arrive in the first chunk
  await expect(page.getByTestId('immediate-data')).toBeVisible({
    timeout: 3000,
  })

  // Deferred data (1s delay) should still be loading at this point
  await expect(page.getByTestId('deferred-loading')).toBeVisible()

  // Wait for it to resolve
  await expect(page.getByTestId('deferred-data')).toContainText(
    'Deferred data loaded!',
    { timeout: 5000 },
  )
})
