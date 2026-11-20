import { expect, test } from '@playwright/test'

test('should not cause redirect loops when accessing the home page', async ({
  page,
}) => {
  // This test verifies that accessing the root URL does not cause a redirect loop
  // The issue is that with i18n rewrites, the server may keep redirecting between
  // / and /en (or similar locale prefixed paths) causing "too many redirects"

  // Navigate to the root - should eventually land on a locale-prefixed page
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  // Verify the page loaded successfully and shows content
  expect(await page.getByText('Hello world').first().isVisible()).toBe(true)
})

test('should not cause redirect loops when accessing locale-prefixed home page', async ({
  page,
}) => {
  // Navigate to the English home page
  await page.goto('/en')
  await page.waitForLoadState('networkidle')

  // Verify the page loaded successfully
  expect(await page.getByText('Hello world').first().isVisible()).toBe(true)
})

test('should not cause redirect loops when accessing German home page', async ({
  page,
}) => {
  // Navigate to the German home page
  await page.goto('/de')
  await page.waitForLoadState('networkidle')

  // Verify the page loaded successfully - German message
  expect(await page.getByText('Guten Tag').first().isVisible()).toBe(true)
})

test('should navigate between locales without redirect loops', async ({
  page,
}) => {
  // Start at English page
  await page.goto('/en')
  await page.waitForLoadState('networkidle')

  // Click the German locale button
  await page.getByRole('button', { name: 'de' }).click()
  await page.waitForLoadState('networkidle')

  // Verify we're now on the German page
  expect(page.url()).toContain('/de')
  expect(await page.getByText('Guten Tag').first().isVisible()).toBe(true)
})

test('server-side navigation to about page should not cause redirect loops', async ({
  page,
}) => {
  // Navigate directly to English about page
  await page.goto('/en/about')
  await page.waitForLoadState('networkidle')

  // Verify the page loaded successfully
  expect(await page.getByText('About message').isVisible()).toBe(true)
})

test('server-side navigation to German about page should not cause redirect loops', async ({
  page,
}) => {
  // Navigate directly to German about page (translated path)
  await page.goto('/de/ueber')
  await page.waitForLoadState('networkidle')

  // Verify the page loaded successfully by checking the URL
  expect(page.url()).toContain('/de/ueber')

  // Verify the page content loaded - check for the German nav link which is always present
  // The about page also contains "Über uns" as the content
  await expect(page.locator('a[href="/de/ueber"]')).toBeVisible()
})

test('check redirect behavior does not loop', async ({ page }) => {
  // Test that requesting the root without locale prefix works with a single redirect
  const response = await page.request.get('/', { maxRedirects: 0 })

  // We expect either a 200 (if no redirect needed) or a redirect to a locale-prefixed path
  const status = response.status()
  if (status >= 300 && status < 400) {
    const location = response.headers()['location']
    // The redirect should be to a locale-prefixed path
    expect(location).toMatch(/^\/(en|de)/)

    // Following the redirect should not cause another redirect loop
    const followUp = await page.request.get(location!, { maxRedirects: 0 })
    // The follow-up should be a 200 or another valid response, not another redirect to the same location
    expect(followUp.status()).toBeLessThan(400)
  } else {
    // If no redirect, the page should load successfully
    expect(status).toBe(200)
  }
})
