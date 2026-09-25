import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Client Component Preload Tests', () => {
  function getLinkHrefs(html: string, rel: string): Array<string> {
    return Array.from(
      html.matchAll(/<link\b[^>]*>/g),
      (match) => match[0],
    ).flatMap((tag) => {
      const relValue = tag.match(/\brel="([^"]*)"/)?.[1]
      const href = tag.match(/\bhref="([^"]*)"/)?.[1]
      return relValue?.split(/\s+/).includes(rel) && href ? [href] : []
    })
  }

  function getModulePreloads(html: string): Array<string> {
    return getLinkHrefs(html, 'modulepreload')
  }

  function getStylesheets(html: string): Array<string> {
    return getLinkHrefs(html, 'stylesheet')
  }

  test('client component JS is modulepreloaded in SSR HTML', async ({
    page,
  }) => {
    const basicHtml = await (await page.goto('/rsc-basic'))?.text()
    const preloadHtml = await (await page.goto('/rsc-client-preload'))?.text()

    expect(basicHtml).toBeDefined()
    expect(preloadHtml).toBeDefined()

    const basicPreloads = getModulePreloads(basicHtml!)
    const preloadPreloads = getModulePreloads(preloadHtml!)

    expect(preloadPreloads.length).toBeGreaterThan(basicPreloads.length)

    const basicPreloadSet = new Set(basicPreloads)
    const extraPreloads = preloadPreloads.filter(
      (href) => !basicPreloadSet.has(href),
    )

    expect(extraPreloads.length).toBeGreaterThan(0)
    expect(extraPreloads.some((href) => href.includes('/assets/'))).toBe(true)
  })

  test('client component CSS is included in SSR HTML', async ({ page }) => {
    const response = await page.goto('/rsc-client-preload')
    const html = await response?.text()
    await page.waitForURL('/rsc-client-preload')

    expect(html).toBeDefined()

    // Verify client component is visible
    await expect(page.getByTestId('client-widget')).toBeVisible()

    const stylesheetHrefs = getStylesheets(html!)

    expect(stylesheetHrefs.length).toBeGreaterThan(0)
    expect(stylesheetHrefs.some((href) => href.includes('/assets/'))).toBe(true)
  })

  test('client component renders with CSS module styles applied', async ({
    page,
  }) => {
    await page.goto('/rsc-client-preload')
    await page.waitForURL('/rsc-client-preload')

    // Verify client component is visible
    const widget = page.getByTestId('client-widget')
    await expect(widget).toBeVisible()

    // Verify CSS module styles are applied
    const backgroundColor = await widget.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    // #dcfce7 in RGB is rgb(220, 252, 231)
    expect(backgroundColor).toBe('rgb(220, 252, 231)')

    const borderColor = await widget.evaluate(
      (el) => getComputedStyle(el).borderColor,
    )
    // #16a34a in RGB is rgb(22, 163, 74)
    expect(borderColor).toBe('rgb(22, 163, 74)')
  })

  test('client component is interactive after hydration', async ({ page }) => {
    await page.goto('/rsc-client-preload')
    await page.waitForURL('/rsc-client-preload')
    await waitForHydration(page)

    // Verify initial count is 0
    await expect(page.getByTestId('client-widget-count')).toHaveText('0')

    // Click increment button
    await page.getByTestId('client-widget-increment').click()
    await expect(page.getByTestId('client-widget-count')).toHaveText('1')

    // Click increment again
    await page.getByTestId('client-widget-increment').click()
    await expect(page.getByTestId('client-widget-count')).toHaveText('2')

    // Click decrement
    await page.getByTestId('client-widget-decrement').click()
    await expect(page.getByTestId('client-widget-count')).toHaveText('1')
  })

  test('hydrates without console errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/rsc-client-preload')
    await page.waitForURL('/rsc-client-preload')
    await waitForHydration(page)

    // Verify content is visible
    await expect(page.getByTestId('client-widget')).toBeVisible()

    // Check for hydration errors
    const hydrationErrors = consoleErrors.filter(
      (msg) =>
        msg.includes('Hydration') ||
        msg.includes('hydration') ||
        msg.includes("didn't match"),
    )
    expect(hydrationErrors).toHaveLength(0)
  })

  test('server component wrapper is rendered', async ({ page }) => {
    await page.goto('/rsc-client-preload')
    await page.waitForURL('/rsc-client-preload')

    // Verify server component wrapper
    await expect(page.getByTestId('rsc-client-preload-server')).toBeVisible()
    await expect(page.getByTestId('rsc-client-preload-title')).toContainText(
      'Client Component Preload Test',
    )

    // Verify client component inside server component slot
    await expect(page.getByTestId('client-widget-badge')).toContainText(
      'CLIENT COMPONENT',
    )
  })

  test('CSS module classes are scoped (hashed)', async ({ page }) => {
    await page.goto('/rsc-client-preload')
    await page.waitForURL('/rsc-client-preload')

    // Get the widget element and verify it has a scoped class name
    const widget = page.getByTestId('client-widget')
    await expect(widget).toBeVisible()

    // Get the class attribute - it should be a hashed class name from CSS modules
    const className = await widget.getAttribute('class')
    expect(className).toBeTruthy()
    // CSS module class names are typically hashed, not plain "widget"
    expect(className).not.toBe('widget')
    // The class should contain some hash characters
    expect(className!.length).toBeGreaterThan(5)
  })

  test('no flash of unstyled content on initial render', async ({ page }) => {
    // This test verifies the page content is rendered from SSR with styles already applied
    // We check that the initial HTML response includes the styled content

    const response = await page.goto('/rsc-client-preload')
    const html = await response?.text()

    // Verify the HTML contains the client widget with a CSS module class
    expect(html).toContain('data-testid="client-widget"')
    // The class should be a hashed CSS module class (contains underscore from module hash)
    // Accept Vite `_widget_xxx` or Rspack `widget-xxx` scoped CSS module names
    expect(html).toMatch(/class="[^"]*(?:_widget_|widget[-_])[\w-]+[^"]*"/)
  })
})
