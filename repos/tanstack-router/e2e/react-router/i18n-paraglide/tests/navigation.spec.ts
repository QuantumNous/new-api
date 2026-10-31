import { expect, test } from '@playwright/test'

// These tests verify that client-side i18n rewrites work correctly in a pure SPA
// (no server-side rendering). The router uses the rewrite API to:
// - input: de-localize URLs for route matching (e.g., /de/ueber -> /about)
// - output: localize URLs for display (e.g., /about -> /de/ueber)

test.describe('Client-side i18n navigation', () => {
  test('should load the home page without redirect loops', async ({ page }) => {
    // Navigate to root - should work without any redirect loop issues
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Verify the page loaded successfully
    await expect(page.getByTestId('home-content')).toBeVisible()
    await expect(page.getByTestId('home-content')).toContainText('Hello world')
  })

  test('should load the German home page (/de)', async ({ page }) => {
    await page.goto('/de')
    await page.waitForLoadState('networkidle')

    // Verify we're on the German page
    await expect(page.getByTestId('home-content')).toBeVisible()
    await expect(page.getByTestId('home-content')).toContainText('Guten Tag')

    // URL should remain /de
    expect(page.url()).toContain('/de')
  })

  test('should navigate to about page and update URL correctly', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Click on about link
    await page.getByTestId('about-link').click()
    await page.waitForLoadState('networkidle')

    // Verify we're on the about page
    await expect(page.getByTestId('about-content')).toBeVisible()
    await expect(page.getByTestId('about-content')).toContainText(
      'Hello /about!',
    )

    // URL should be /about (English)
    expect(page.url()).toContain('/about')
  })

  test('should navigate to German about page with translated URL', async ({
    page,
  }) => {
    await page.goto('/de')
    await page.waitForLoadState('networkidle')

    // Click on about link (should navigate to /de/ueber)
    await page.getByTestId('about-link').click()
    await page.waitForLoadState('networkidle')

    // Verify we're on the about page with German content
    await expect(page.getByTestId('about-content')).toBeVisible()
    await expect(page.getByTestId('about-content')).toContainText(
      'Hallo /ueber!',
    )

    // URL should be /de/ueber (German translated path)
    expect(page.url()).toContain('/de/ueber')
  })

  test('should directly access German about page (/de/ueber)', async ({
    page,
  }) => {
    // Direct navigation to translated URL
    await page.goto('/de/ueber')
    await page.waitForLoadState('networkidle')

    // Verify the page loaded correctly
    await expect(page.getByTestId('about-content')).toBeVisible()
    await expect(page.getByTestId('about-content')).toContainText(
      'Hallo /ueber!',
    )

    // URL should stay /de/ueber
    expect(page.url()).toContain('/de/ueber')
  })

  test('should switch locale and update URLs accordingly', async ({ page }) => {
    // Start at English home page
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Verify English content
    await expect(page.getByTestId('home-content')).toContainText('Hello world')

    // Switch to German
    await page.getByTestId('locale-de').click()
    await page.waitForLoadState('networkidle')

    // Verify German content
    await expect(page.getByTestId('home-content')).toContainText('Guten Tag')

    // URL should now include /de
    expect(page.url()).toContain('/de')
  })

  test('should switch locale on about page and update translated URL', async ({
    page,
  }) => {
    // Start at English about page
    await page.goto('/about')
    await page.waitForLoadState('networkidle')

    // Verify English content
    await expect(page.getByTestId('about-content')).toContainText(
      'Hello /about!',
    )

    // Switch to German
    await page.getByTestId('locale-de').click()
    await page.waitForLoadState('networkidle')

    // Verify German content
    await expect(page.getByTestId('about-content')).toContainText(
      'Hallo /ueber!',
    )

    // URL should now be /de/ueber (translated path)
    expect(page.url()).toContain('/de/ueber')
  })

  test('should maintain correct links after locale switch', async ({
    page,
  }) => {
    // Start at German home page
    await page.goto('/de')
    await page.waitForLoadState('networkidle')

    // Verify about link has German translated href
    const aboutLink = page.getByTestId('about-link')
    await expect(aboutLink).toHaveAttribute('href', '/de/ueber')

    // Switch to English
    await page.getByTestId('locale-en').click()
    await page.waitForLoadState('networkidle')

    // Verify about link now has English href
    await expect(aboutLink).toHaveAttribute('href', '/about')
  })
})

test.describe('Client-side navigation without redirect loops', () => {
  test('navigating back and forth should not cause issues', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate to about
    await page.getByTestId('about-link').click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('about-content')).toBeVisible()

    // Navigate back to home
    await page.getByTestId('home-link').click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('home-content')).toBeVisible()

    // Navigate to about again
    await page.getByTestId('about-link').click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('about-content')).toBeVisible()
  })

  test('switching locales multiple times should work correctly', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Switch to German
    await page.getByTestId('locale-de').click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('home-content')).toContainText('Guten Tag')

    // Switch back to English
    await page.getByTestId('locale-en').click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('home-content')).toContainText('Hello world')

    // Switch to German again
    await page.getByTestId('locale-de').click()
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('home-content')).toContainText('Guten Tag')
  })

  test('browser back/forward should work with locale changes', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate to about
    await page.getByTestId('about-link').click()
    await page.waitForLoadState('networkidle')

    // Switch to German
    await page.getByTestId('locale-de').click()
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/de/ueber')

    // Go back
    await page.goBack()
    await page.waitForLoadState('networkidle')

    // Should be on about page (English or previous state)
    await expect(page.getByTestId('about-content')).toBeVisible()
  })
})

test.describe('URL rewrite consistency', () => {
  test('internal navigation should use rewritten URLs in links', async ({
    page,
  }) => {
    await page.goto('/de')
    await page.waitForLoadState('networkidle')

    // Check that links are properly localized
    const homeLink = page.getByTestId('home-link')
    const aboutLink = page.getByTestId('about-link')

    await expect(homeLink).toHaveAttribute('href', '/de')
    await expect(aboutLink).toHaveAttribute('href', '/de/ueber')
  })

  test('English links should not have locale prefix', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const homeLink = page.getByTestId('home-link')
    const aboutLink = page.getByTestId('about-link')

    await expect(homeLink).toHaveAttribute('href', '/')
    await expect(aboutLink).toHaveAttribute('href', '/about')
  })
})
