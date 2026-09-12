import { expect, test, testWithHydration } from './fixtures'

test.describe('Fast serialization (serialization completes before render)', () => {
  test('initial HTML contains router bootstrap + barrier', async ({ page }) => {
    let responseHtml = ''
    await page.route('/fast-serial', async (route) => {
      const response = await route.fetch()
      responseHtml = await response.text()
      await route.fulfill({ response })
    })

    await page.goto('/fast-serial')
    await expect(page.getByTestId('server-data')).toBeVisible()

    expect(responseHtml).toContain('$_TSR')
    expect(responseHtml).toContain('$_TSR.router')
    expect(responseHtml).toContain('$_TSR.e()')
    expect(responseHtml).toContain('$tsr-stream-barrier')
  })

  test('all data is available immediately', async ({ page }) => {
    await page.goto('/fast-serial')
    await page.waitForLoadState('networkidle')

    // All data should be visible
    await expect(page.getByTestId('server-data')).toContainText('small-data')
    await expect(page.getByTestId('static-data')).toContainText(
      'This is static data',
    )
    await expect(page.getByTestId('loader-timestamp')).toBeVisible()

    // Verify data came from server (proves SSR streaming worked)
    await expect(page.getByTestId('loader-source')).toContainText(
      'Loader source: server',
    )
    await expect(page.getByTestId('server-fn-source')).toContainText(
      'Server function source: server',
    )
  })

  testWithHydration('hydration works correctly', async ({ page }) => {
    await page.goto('/fast-serial')
    await page.waitForLoadState('networkidle')

    // Verify data came from server after hydration
    await expect(page.getByTestId('loader-source')).toContainText(
      'Loader source: server',
    )
  })

  test('direct navigation renders correctly', async ({ page }) => {
    // Direct navigation (SSR)
    await page.goto('/fast-serial')

    // Should render without errors and show server source
    await expect(page.getByTestId('server-data')).toBeVisible()
    await expect(page.getByTestId('loader-source')).toContainText(
      'Loader source: server',
    )
  })

  test('client-side navigation works', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate via nav link
    await page.getByRole('link', { name: 'Fast Serial' }).first().click()
    await expect(page).toHaveURL('/fast-serial')

    await expect(page.getByTestId('server-data')).toContainText('small-data')
  })
})
