import { expect, test, testWithHydration } from './fixtures'

test.describe('Client-side navigation between all routes', () => {
  test.beforeEach(async ({ page }) => {
    // Start from home page
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('home -> sync-only -> home works', async ({ page }) => {
    // Navigate to sync-only
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Sync Only' })
      .click()
    await expect(page).toHaveURL('/sync-only')
    await expect(page.getByTestId('sync-message')).toBeVisible()

    // Navigate back to home
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Home' })
      .click()
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('index-title')).toBeVisible()
  })

  test('home -> deferred -> home works', async ({ page }) => {
    // Navigate to deferred (use exact: true to avoid matching "Nested Deferred")
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Deferred', exact: true })
      .click()
    await expect(page).toHaveURL('/deferred')
    await expect(page.getByTestId('immediate-data')).toBeVisible()

    // Wait for deferred data
    await expect(page.getByTestId('deferred-data')).toBeVisible({
      timeout: 5000,
    })

    // Navigate back to home
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Home' })
      .click()
    await expect(page).toHaveURL('/')
  })

  test('home -> stream -> home works (no stream locking error)', async ({
    page,
  }) => {
    // This test specifically validates the ReadableStream locking fix
    // Console errors are monitored by the fixture automatically

    // Navigate to stream
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Stream' })
      .click()
    await expect(page).toHaveURL('/stream')

    // Wait for stream to start (at least one chunk or promise resolved)
    await expect(page.getByTestId('promise-data')).toBeVisible({
      timeout: 5000,
    })

    // Navigate back to home before stream completes
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Home' })
      .click()
    await expect(page).toHaveURL('/')
  })

  test('home -> stream -> wait for completion -> home works', async ({
    page,
  }) => {
    // Navigate to stream
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Stream' })
      .click()
    await expect(page).toHaveURL('/stream')

    // Wait for stream to complete
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Navigate back to home
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Home' })
      .click()
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('index-title')).toBeVisible()
  })

  test('home -> stream -> home -> stream again works (fresh stream each time)', async ({
    page,
  }) => {
    // Console errors are monitored by the fixture automatically

    // First navigation to stream
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Stream' })
      .click()
    await expect(page).toHaveURL('/stream')
    await expect(page.getByTestId('promise-data')).toBeVisible({
      timeout: 5000,
    })

    // Navigate back to home
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Home' })
      .click()
    await expect(page).toHaveURL('/')

    // Second navigation to stream - should get fresh stream without errors
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Stream' })
      .click()
    await expect(page).toHaveURL('/stream')

    // Wait for stream to complete
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })

    // Verify all chunks are present
    await expect(page.getByTestId('stream-chunk-0')).toBeVisible()
    await expect(page.getByTestId('stream-chunk-4')).toBeVisible()
  })

  test('home -> fast-serial -> home works', async ({ page }) => {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Fast Serial' })
      .click()
    await expect(page).toHaveURL('/fast-serial')
    await expect(page.getByTestId('server-data')).toBeVisible()

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Home' })
      .click()
    await expect(page).toHaveURL('/')
  })

  test('home -> slow-render -> home works', async ({ page }) => {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Slow Render' })
      .click()
    await expect(page).toHaveURL('/slow-render')
    await expect(page.getByTestId('quick-data')).toBeVisible()

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Home' })
      .click()
    await expect(page).toHaveURL('/')
  })

  test('home -> nested-deferred -> home works', async ({ page }) => {
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Nested Deferred' })
      .click()
    await expect(page).toHaveURL('/nested-deferred')

    // Wait for all levels to load
    await expect(page.getByTestId('level3-data')).toBeVisible({ timeout: 5000 })

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Home' })
      .click()
    await expect(page).toHaveURL('/')
  })

  test('rapid navigation between routes works', async ({ page }) => {
    // Console errors are monitored by the fixture automatically

    // Rapid navigation sequence
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Sync Only' })
      .click()
    await expect(page).toHaveURL('/sync-only')

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Deferred', exact: true })
      .click()
    await expect(page).toHaveURL('/deferred')

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Stream' })
      .click()
    await expect(page).toHaveURL('/stream')

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Fast Serial' })
      .click()
    await expect(page).toHaveURL('/fast-serial')

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Slow Render' })
      .click()
    await expect(page).toHaveURL('/slow-render')

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Nested Deferred' })
      .click()
    await expect(page).toHaveURL('/nested-deferred')

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Home' })
      .click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('Direct navigation followed by client navigation', () => {
  test('direct to stream -> client nav to deferred works', async ({ page }) => {
    // Direct navigation to stream
    await page.goto('/stream')
    await expect(page.getByTestId('promise-data')).toBeVisible({
      timeout: 5000,
    })

    // Client navigation to deferred (use exact: true)
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Deferred', exact: true })
      .click()
    await expect(page).toHaveURL('/deferred')
    await expect(page.getByTestId('immediate-data')).toBeVisible()
  })

  test('direct to deferred -> client nav to stream works', async ({ page }) => {
    // Console errors are monitored by the fixture automatically

    // Direct navigation to deferred
    await page.goto('/deferred')
    await expect(page.getByTestId('immediate-data')).toBeVisible()

    // Client navigation to stream
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Stream' })
      .click()
    await expect(page).toHaveURL('/stream')
    await expect(page.getByTestId('stream-complete')).toBeVisible({
      timeout: 10000,
    })
  })

  test('direct to sync-only -> client nav to all routes works', async ({
    page,
  }) => {
    await page.goto('/sync-only')
    await expect(page.getByTestId('sync-message')).toBeVisible()

    // Navigate through all routes
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Deferred', exact: true })
      .click()
    await expect(page).toHaveURL('/deferred')

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Stream' })
      .click()
    await expect(page).toHaveURL('/stream')

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Fast Serial' })
      .click()
    await expect(page).toHaveURL('/fast-serial')

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Home' })
      .click()
    await expect(page).toHaveURL('/')
  })
})

testWithHydration.describe('Hydration after client navigation', () => {
  testWithHydration(
    'interactive elements work after navigating to deferred',
    async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      await page
        .getByRole('navigation')
        .getByRole('link', { name: 'Deferred', exact: true })
        .click()
      await expect(page).toHaveURL('/deferred')

      // Wait for the page to be fully loaded
      await expect(page.getByTestId('immediate-data')).toBeVisible()
    },
  )

  testWithHydration(
    'interactive elements work after navigating to fast-serial',
    async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      await page
        .getByRole('navigation')
        .getByRole('link', { name: 'Fast Serial' })
        .click()
      await expect(page).toHaveURL('/fast-serial')

      // Wait for page to load
      await expect(page.getByTestId('server-data')).toBeVisible()
    },
  )

  testWithHydration(
    'interactive elements work after navigating to nested-deferred',
    async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      await page
        .getByRole('navigation')
        .getByRole('link', { name: 'Nested Deferred' })
        .click()
      await expect(page).toHaveURL('/nested-deferred')

      // Wait for page to load
      await expect(page.getByTestId('plain-deferred')).toBeVisible({
        timeout: 5000,
      })
    },
  )

  testWithHydration(
    'interactive elements work after navigating to slow-render',
    async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      await page
        .getByRole('navigation')
        .getByRole('link', { name: 'Slow Render' })
        .click()
      await expect(page).toHaveURL('/slow-render')

      // Wait for page to load (slow-render has blocking loops)
      await expect(page.getByTestId('quick-data')).toBeVisible()
    },
  )
})
