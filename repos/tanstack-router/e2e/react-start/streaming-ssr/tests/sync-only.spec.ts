import { expect } from '@playwright/test'
import { test, testWithHydration } from './fixtures'

/**
 * Tests for synchronous serialization - no deferred data, no streaming.
 * This is the most common case where all loader data is immediately available.
 * The hydration scripts should be included in the initial HTML response.
 */

test('Sync-only route renders with loader data', async ({ page }) => {
  await page.goto('/sync-only')

  // Verify the page content is rendered
  await expect(page.getByTestId('sync-title')).toContainText(
    'Synchronous Serialization Test',
  )
  await expect(page.getByTestId('sync-message')).toContainText(
    'Hello from sync loader!',
  )

  // Verify loader data items are rendered
  await expect(page.getByTestId('sync-item-item-1')).toBeVisible()
  await expect(page.getByTestId('sync-item-item-2')).toBeVisible()
  await expect(page.getByTestId('sync-item-item-3')).toBeVisible()

  // Verify data came from server (proves SSR streaming worked)
  await expect(page.getByTestId('sync-source')).toContainText('Source: server')
})

testWithHydration('Sync-only route hydrates correctly', async ({ page }) => {
  await page.goto('/sync-only')

  // Verify client-side navigation works (proves hydration succeeded)
  await page.getByRole('navigation').getByRole('link', { name: 'Home' }).click()
  await expect(page.getByTestId('index-title')).toBeVisible()

  // Navigate back to sync-only via client-side navigation (use nav link to be specific)
  await page
    .getByRole('navigation')
    .getByRole('link', { name: 'Sync Only' })
    .click()
  await expect(page.getByTestId('sync-title')).toBeVisible()
})

test('Sync-only route has bootstrap scripts in initial HTML', async ({
  page,
}) => {
  // Intercept the response to check the raw HTML
  let responseHtml = ''
  await page.route('/sync-only', async (route) => {
    const response = await route.fetch()
    responseHtml = await response.text()
    await route.fulfill({ response })
  })

  await page.goto('/sync-only')

  // Wait for page to load
  await expect(page.getByTestId('sync-title')).toBeVisible()

  // The HTML should contain the bootstrap scripts
  // $_TSR.router should be present (the dehydrated router state)
  expect(responseHtml).toContain('$_TSR')
  expect(responseHtml).toContain('$_TSR.router')
  // The serialization end marker should be present
  expect(responseHtml).toContain('$_TSR.e()')

  // SSR should include the barrier script tag in the HTML (rendered by <Scripts />)
  // This is the critical marker transformStreamWithRouter can scan for.
  expect(responseHtml).toContain('$tsr-stream-barrier')
})

test('Navigating to sync-only from home page', async ({ page }) => {
  await page.goto('/')

  await page.getByTestId('link-sync-only').click()

  await expect(page.getByTestId('sync-title')).toContainText(
    'Synchronous Serialization Test',
  )
  await expect(page.getByTestId('sync-message')).toContainText(
    'Hello from sync loader!',
  )
})
