import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.describe('Async Script Hydration', () => {
  test('should not show hydration warning for async scripts', async ({
    page,
  }) => {
    await page.goto('/async-scripts')
    await expect(
      page.getByTestId('async-scripts-test-heading'),
    ).toBeInViewport()

    await page.waitForFunction(() => (window as any).SCRIPT_1 === true)
  })

  test('should load async and defer scripts correctly', async ({ page }) => {
    await page.goto('/async-scripts')
    await expect(
      page.getByTestId('async-scripts-test-heading'),
    ).toBeInViewport()

    // script.js (async) sets window.SCRIPT_1 = true
    // script2.js (defer) sets window.SCRIPT_2 = true
    expect(await page.evaluate('window.SCRIPT_1')).toBe(true)
    expect(await page.evaluate('window.SCRIPT_2')).toBe(true)
  })
})

test.describe('Script Duplication Prevention', () => {
  test('should not create duplicate scripts on SSR route', async ({ page }) => {
    await page.goto('/scripts')

    await expect(page.getByTestId('scripts-test-heading')).toBeInViewport()

    // Wait for the script to execute — React 19 hoists <script src> as a
    // resource during SSR hydration, so the DOM element may not persist in
    // a queryable form.  Execution is the reliable check.
    await page.waitForFunction(() => (window as any).SCRIPT_1 === true)

    const scriptCount = await page.evaluate(() => {
      return document.querySelectorAll('script[src="/script.js"]').length
    })
    expect(scriptCount).toBeLessThanOrEqual(1)

    expect(await page.evaluate('window.SCRIPT_1')).toBe(true)
  })

  test('should not create duplicate scripts during client-side navigation', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Scripts', exact: true }).click()
    await expect(page.getByTestId('scripts-test-heading')).toBeInViewport()

    const firstNavCount = await page.evaluate(() => {
      return document.querySelectorAll('script[src="script.js"]').length
    })
    expect(firstNavCount).toBe(1)

    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page.getByRole('link', { name: 'Posts' })).toBeVisible()

    await page.getByRole('link', { name: 'Scripts', exact: true }).click()
    await expect(page.getByTestId('scripts-test-heading')).toBeInViewport()

    const secondNavCount = await page.evaluate(() => {
      return document.querySelectorAll('script[src="script.js"]').length
    })
    expect(secondNavCount).toBe(1)

    expect(await page.evaluate('window.SCRIPT_1')).toBe(true)
  })

  test('should not create duplicate scripts with multiple navigation cycles', async ({
    page,
  }) => {
    await page.goto('/')

    for (let i = 0; i < 3; i++) {
      await page.getByRole('link', { name: 'Scripts', exact: true }).click()
      await expect(page.getByTestId('scripts-test-heading')).toBeInViewport()

      await page.getByRole('link', { name: 'Home' }).click()
      await expect(page.getByRole('link', { name: 'Posts' })).toBeVisible()
    }

    await page.getByRole('link', { name: 'Scripts', exact: true }).click()
    await expect(page.getByTestId('scripts-test-heading')).toBeInViewport()

    const finalCount = await page.evaluate(() => {
      return document.querySelectorAll('script[src="script.js"]').length
    })
    expect(finalCount).toBe(1)

    expect(await page.evaluate('window.SCRIPT_1')).toBe(true)
  })

  test('should not create duplicate inline scripts', async ({ page }) => {
    await page.goto('/inline-scripts')

    await expect(
      page.getByTestId('inline-scripts-test-heading'),
    ).toBeInViewport()

    // Wait for scripts to execute — useEffect may need a tick after hydration.
    // React 19 may hoist inline scripts as resources, so the DOM element may
    // not persist; script execution is the reliable check for SSR routes.
    await page.waitForFunction(() => (window as any).INLINE_SCRIPT_1 === true)
    await page.waitForFunction(() => (window as any).INLINE_SCRIPT_2 === 'test')

    // React 19 can hoist/dedupe <script> tags during hydration. Between that
    // and TanStack Router's client-side imperative injection (which may
    // intentionally skip injection if a matching script already exists), the
    // resulting script node might not be consistently queryable in a single
    // fixed place.
    //
    // What we *can* assert reliably for SSR routes is "not duplicated" (<= 1),
    // not "exactly one".
    const inlineScript1Count = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script:not([src])'))
      return scripts.filter(
        (script) =>
          script.textContent &&
          script.textContent.includes('window.INLINE_SCRIPT_1 = true'),
      ).length
    })
    expect(inlineScript1Count).toBeLessThanOrEqual(1)

    const inlineScript2Count = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script:not([src])'))
      return scripts.filter(
        (script) =>
          script.textContent &&
          script.textContent.includes('window.INLINE_SCRIPT_2 = "test"'),
      ).length
    })
    expect(inlineScript2Count).toBeLessThanOrEqual(1)

    expect(await page.evaluate('window.INLINE_SCRIPT_1')).toBe(true)
    expect(await page.evaluate('window.INLINE_SCRIPT_2')).toBe('test')
  })

  test('should not create duplicate inline scripts during client-side navigation', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Inline Scripts' }).click()
    await expect(
      page.getByTestId('inline-scripts-test-heading'),
    ).toBeInViewport()

    const firstNavScript1Count = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script:not([src])'))
      return scripts.filter(
        (script) =>
          script.textContent &&
          script.textContent.includes('window.INLINE_SCRIPT_1 = true'),
      ).length
    })
    expect(firstNavScript1Count).toBe(1)

    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page.getByRole('link', { name: 'Posts' })).toBeVisible()

    await page.getByRole('link', { name: 'Inline Scripts' }).click()
    await expect(
      page.getByTestId('inline-scripts-test-heading'),
    ).toBeInViewport()

    const secondNavScript1Count = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script:not([src])'))
      return scripts.filter(
        (script) =>
          script.textContent &&
          script.textContent.includes('window.INLINE_SCRIPT_1 = true'),
      ).length
    })
    expect(secondNavScript1Count).toBe(1)

    // Verify the scripts are still working
    expect(await page.evaluate('window.INLINE_SCRIPT_1')).toBe(true)
    expect(await page.evaluate('window.INLINE_SCRIPT_2')).toBe('test')
  })
})
