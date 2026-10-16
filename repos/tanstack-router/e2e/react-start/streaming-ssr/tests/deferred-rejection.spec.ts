import { expect, test } from './fixtures'

test.use({
  whitelistErrors: ['Error in deferred object'],
})

test('rejected deferred Await renders the route error boundary without killing SSR', async ({
  page,
}) => {
  await page.goto('/deferred-rejection')

  await expect(page.getByTestId('deferred-error-boundary')).toContainText(
    'Error in deferred object',
    { timeout: 5000 },
  )

  await page.goto('/sync-only')
  await expect(page.getByTestId('sync-message')).toContainText(
    'Hello from sync loader!',
  )
})
