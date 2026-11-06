import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

// Whitelist errors that can occur in CI:
// - net::ERR_NAME_NOT_RESOLVED: transient network issues
// - 504 (Outdated Optimize Dep): Vite dependency optimization reload
// - net::ERR_INTERNET_DISCONNECTED: transient network issues
const whitelistErrors = [
  'Failed to load resource: net::ERR_NAME_NOT_RESOLVED',
  'Failed to load resource: net::ERR_INTERNET_DISCONNECTED',
  'Failed to load resource: the server responded with a status of 504',
]

test.describe('CSS styles in SSR (dev mode)', () => {
  test.use({ whitelistErrors })

  // Helper to build full URL from baseURL and path
  // Playwright's goto with absolute paths (like '/modules') ignores baseURL's path portion
  // So we need to manually construct the full URL
  const buildUrl = (baseURL: string, path: string) => {
    return baseURL.replace(/\/$/, '') + path
  }

  test.describe('with JavaScript disabled', () => {
    test.use({ javaScriptEnabled: false, whitelistErrors })

    test('global CSS is applied on initial page load', async ({
      page,
      baseURL,
    }) => {
      await page.goto(buildUrl(baseURL!, '/'))

      const element = page.getByTestId('global-styled')
      await expect(element).toBeVisible()

      // Verify the CSS is applied by checking computed styles
      // #3b82f6 (blue-500) in RGB is rgb(59, 130, 246)
      const backgroundColor = await element.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      expect(backgroundColor).toBe('rgb(59, 130, 246)')

      const padding = await element.evaluate(
        (el) => getComputedStyle(el).padding,
      )
      expect(padding).toBe('24px')

      const borderRadius = await element.evaluate(
        (el) => getComputedStyle(el).borderRadius,
      )
      expect(borderRadius).toBe('12px')
    })

    test('CSS modules are applied on initial page load', async ({
      page,
      baseURL,
    }) => {
      await page.goto(buildUrl(baseURL!, '/modules'))

      const card = page.getByTestId('module-card')
      await expect(card).toBeVisible()

      // Verify class is scoped (hashed)
      const className = await card.getAttribute('class')
      expect(className).toBeTruthy()
      expect(className).not.toBe('card')
      // The class should contain some hash characters (CSS modules add a hash)
      expect(className!.length).toBeGreaterThan(5)

      // Verify computed styles from card.module.css
      // #f0fdf4 (green-50) in RGB is rgb(240, 253, 244)
      const backgroundColor = await card.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      expect(backgroundColor).toBe('rgb(240, 253, 244)')

      const padding = await card.evaluate((el) => getComputedStyle(el).padding)
      expect(padding).toBe('16px')

      const borderRadius = await card.evaluate(
        (el) => getComputedStyle(el).borderRadius,
      )
      expect(borderRadius).toBe('8px')
    })

    test('global CSS class names are NOT scoped', async ({ page, baseURL }) => {
      await page.goto(buildUrl(baseURL!, '/'))

      const element = page.getByTestId('global-styled')
      await expect(element).toBeVisible()

      // Get the class attribute - it should be the plain class name (not hashed)
      const className = await element.getAttribute('class')
      expect(className).toBe('global-container')
    })

    test('Sass mixin styles are applied on initial page load', async ({
      page,
      baseURL,
    }) => {
      await page.goto(buildUrl(baseURL!, '/sass-mixin'))

      const element = page.getByTestId('mixin-styled')
      await expect(element).toBeVisible()

      // Verify the mixin is applied (display: flex from center-mixin)
      const display = await element.evaluate(
        (el) => getComputedStyle(el).display,
      )
      expect(display).toBe('flex')

      const justifyContent = await element.evaluate(
        (el) => getComputedStyle(el).justifyContent,
      )
      expect(justifyContent).toBe('center')

      const alignItems = await element.evaluate(
        (el) => getComputedStyle(el).alignItems,
      )
      expect(alignItems).toBe('center')

      // Verify other styles from mixin-consumer.scss
      // #a855f7 (purple-500) in RGB is rgb(168, 85, 247)
      const backgroundColor = await element.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      expect(backgroundColor).toBe('rgb(168, 85, 247)')

      const padding = await element.evaluate(
        (el) => getComputedStyle(el).padding,
      )
      expect(padding).toBe('24px')
    })
  })

  test('styles persist after hydration', async ({ page, baseURL }) => {
    await page.goto(buildUrl(baseURL!, '/'))

    // Wait for hydration and styles to be applied
    const element = page.getByTestId('global-styled')
    await expect(element).toBeVisible()

    // Wait for CSS to be applied (background color should not be transparent)
    await expect(async () => {
      const backgroundColor = await element.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      expect(backgroundColor).toBe('rgb(59, 130, 246)')
    }).toPass({ timeout: 5000 })
  })

  test('CSS modules styles persist after hydration', async ({
    page,
    baseURL,
  }) => {
    await page.goto(buildUrl(baseURL!, '/modules'))

    // Wait for hydration and styles to be applied
    const card = page.getByTestId('module-card')
    await expect(card).toBeVisible()

    // Wait for CSS to be applied (background color should not be transparent)
    await expect(async () => {
      const backgroundColor = await card.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      expect(backgroundColor).toBe('rgb(240, 253, 244)')
    }).toPass({ timeout: 5000 })
  })

  test('styles work correctly after client-side navigation', async ({
    page,
    baseURL,
  }) => {
    // Start from home
    await page.goto(buildUrl(baseURL!, '/'))

    // Verify initial styles
    const globalElement = page.getByTestId('global-styled')
    await expect(globalElement).toBeVisible()
    let backgroundColor = await globalElement.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(backgroundColor).toBe('rgb(59, 130, 246)')

    // Navigate to modules page
    await page.getByTestId('nav-modules').click()
    await page.waitForURL('**/modules')

    // Verify CSS modules styles
    const card = page.getByTestId('module-card')
    await expect(card).toBeVisible()
    backgroundColor = await card.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(backgroundColor).toBe('rgb(240, 253, 244)')

    // Navigate back to home
    await page.getByTestId('nav-home').click()
    await page.waitForURL(/\/([^/]*)(\/)?($|\?)/)

    // Verify global styles still work
    await expect(globalElement).toBeVisible()
    backgroundColor = await globalElement.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(backgroundColor).toBe('rgb(59, 130, 246)')
  })
})
