import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

function getStylesheetHrefs(html: string): Array<string> {
  return Array.from(
    html.matchAll(/<link\b[^>]*>/g),
    (match) => match[0],
  ).flatMap((tag) => {
    const rel = tag.match(/\brel="([^"]*)"/)?.[1]
    const href = tag.match(/\bhref="([^"]*)"/)?.[1]
    return rel?.split(/\s+/).includes('stylesheet') && href ? [href] : []
  })
}

/**
 * RSC No-JavaScript Tests
 *
 * These tests verify that RSC content renders correctly in the initial HTML
 * without requiring JavaScript. This ensures proper SSR of server components.
 *
 * Note: Only routes without streaming/suspense boundaries work correctly
 * with JS disabled, as streaming requires client-side JS to process chunks.
 */
test.describe('RSC No-JavaScript Rendering', () => {
  // Use a fresh context with JS disabled for each test
  test.use({ javaScriptEnabled: false })

  test('/rsc-basic renders server component content without JS', async ({
    page,
  }) => {
    await page.goto('/rsc-basic')

    // Page title should be visible
    await expect(page.getByTestId('rsc-basic-title')).toBeVisible()
    await expect(page.getByTestId('rsc-basic-title')).toHaveText(
      'User Profile Card',
    )

    // Server component content should be present in HTML
    await expect(page.getByTestId('rsc-basic-content')).toBeVisible()

    // Server-rendered timestamp should be visible
    await expect(page.getByTestId('rsc-server-timestamp')).toBeVisible()

    // The server badge should indicate this is server-rendered
    await expect(page.getByTestId('rsc-server-badge')).toBeVisible()

    // User data should be visible (server-rendered)
    await expect(page.getByTestId('rsc-label')).toBeVisible()
  })

  test('/rsc-multi renders multiple server components without JS', async ({
    page,
  }) => {
    await page.goto('/rsc-multi')

    // Page title should be visible
    await expect(page.getByTestId('rsc-multi-title')).toBeVisible()
    await expect(page.getByTestId('rsc-multi-title')).toHaveText(
      'News Feed - Multiple RSCs',
    )

    // All three server components should be rendered
    await expect(page.getByTestId('rsc-multi-a-content')).toBeVisible()
    await expect(page.getByTestId('rsc-multi-b-content')).toBeVisible()
    await expect(page.getByTestId('rsc-multi-c-content')).toBeVisible()

    // Each should have server-rendered timestamps
    await expect(page.getByTestId('rsc-multi-a-timestamp')).toBeVisible()
    await expect(page.getByTestId('rsc-multi-b-timestamp')).toBeVisible()
    await expect(page.getByTestId('rsc-multi-c-timestamp')).toBeVisible()
  })

  test('/rsc-nested renders nested server components without JS', async ({
    page,
  }) => {
    await page.goto('/rsc-nested')

    // Page title should be visible
    await expect(page.getByTestId('rsc-nested-title')).toBeVisible()

    // Product card RSC should be rendered
    await expect(page.getByTestId('rsc-product-card')).toBeVisible()
    await expect(page.getByTestId('rsc-product-name')).toBeVisible()

    // Product reviews RSC should be rendered (inside client wrapper, but SSR'd)
    await expect(page.getByTestId('reviews-section')).toBeVisible()
    await expect(page.getByTestId('reviews-content')).toBeVisible()
    await expect(page.getByTestId('rsc-product-reviews')).toBeVisible()
  })

  test('/rsc-slots renders slotted server component without JS', async ({
    page,
  }) => {
    await page.goto('/rsc-slots')

    // Page title should be visible
    await expect(page.getByTestId('rsc-slots-title')).toBeVisible()
    await expect(page.getByTestId('rsc-slots-title')).toHaveText(
      'Dashboard with Interactive Widgets',
    )

    // Server component content should be present
    await expect(page.getByTestId('rsc-slotted-content')).toBeVisible()

    // Server-rendered timestamp should be visible
    await expect(page.getByTestId('rsc-slotted-timestamp')).toBeVisible()

    // Server component title should be rendered
    await expect(page.getByTestId('rsc-slotted-title')).toBeVisible()

    // Slot content (children) should be SSR'd too
    await expect(page.getByTestId('rsc-slotted-children')).toBeVisible()
  })

  test('/rsc-tree renders tree server component with slots without JS', async ({
    page,
  }) => {
    await page.goto('/rsc-tree')

    // Page title should be visible
    await expect(page.getByTestId('rsc-tree-title')).toBeVisible()

    // Server component tree should be rendered
    await expect(page.getByTestId('rsc-tree-content')).toBeVisible()

    // Server-rendered timestamp should be visible
    await expect(page.getByTestId('rsc-tree-timestamp')).toBeVisible()

    // Parent element should be rendered
    await expect(page.getByTestId('rsc-parent')).toBeVisible()
  })

  test('index page renders without JS', async ({ page }) => {
    await page.goto('/')

    // Index page should render
    await expect(page.getByTestId('home-title')).toBeVisible()

    // Navigation links should be present (even if not clickable without JS)
    await expect(page.getByTestId('nav-basic')).toBeVisible()
    await expect(page.getByTestId('nav-slots')).toBeVisible()
  })

  test('/rsc-css-modules renders server component content without JS', async ({
    page,
  }) => {
    await page.goto('/rsc-css-modules')

    // Page title should be visible
    await expect(page.getByTestId('rsc-css-modules-page-title')).toBeVisible()
    await expect(page.getByTestId('rsc-css-modules-page-title')).toHaveText(
      'CSS Modules in RSC',
    )

    // Server component content should be present in HTML (not hidden behind Suspense)
    const content = page.getByTestId('rsc-css-modules-content')
    await expect(content).toBeVisible()

    // Verify class is scoped (hashed) - CSS modules should produce hashed class names
    const className = await content.getAttribute('class')
    expect(className).toBeTruthy()
    expect(className).not.toBe('container') // Should be hashed, not plain
    expect(className!.length).toBeGreaterThan(5) // Hashed names are longer

    // Verify CSS styles are actually applied
    // .container has background-color: #e0f2fe which is rgb(224, 242, 254)
    const backgroundColor = await content.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(backgroundColor).toBe('rgb(224, 242, 254)')

    // .container has border-radius: 8px
    const borderRadius = await content.evaluate(
      (el) => getComputedStyle(el).borderRadius,
    )
    expect(borderRadius).toBe('8px')

    // .container has padding: 16px
    const padding = await content.evaluate((el) => getComputedStyle(el).padding)
    expect(padding).toBe('16px')

    // Server-rendered badge and timestamp should be visible
    await expect(page.getByTestId('rsc-css-modules-badge')).toBeVisible()
    await expect(page.getByTestId('rsc-css-modules-badge')).toHaveText(
      'SERVER RENDERED',
    )
    await expect(page.getByTestId('rsc-css-modules-timestamp')).toBeVisible()

    // Features list should be rendered
    await expect(page.getByTestId('rsc-css-modules-features')).toBeVisible()
    await expect(page.getByTestId('rsc-css-modules-feature-1')).toBeVisible()
  })

  test('/rsc-global-css renders server component content without JS', async ({
    page,
  }) => {
    await page.goto('/rsc-global-css')

    // Page title should be visible
    await expect(page.getByTestId('rsc-global-css-page-title')).toBeVisible()
    await expect(page.getByTestId('rsc-global-css-page-title')).toHaveText(
      'Global CSS in RSC',
    )

    // Server component content should be present in HTML (not hidden behind Suspense)
    const content = page.getByTestId('rsc-global-css-content')
    await expect(content).toBeVisible()

    // Verify class is NOT scoped - global CSS should have plain class names
    const className = await content.getAttribute('class')
    expect(className).toBe('rsc-global-container')

    // Verify CSS styles are actually applied
    // .rsc-global-container has background-color: #e0f2fe which is rgb(224, 242, 254)
    const backgroundColor = await content.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(backgroundColor).toBe('rgb(224, 242, 254)')

    // .rsc-global-container has border-radius: 8px
    const borderRadius = await content.evaluate(
      (el) => getComputedStyle(el).borderRadius,
    )
    expect(borderRadius).toBe('8px')

    // .rsc-global-container has padding: 16px
    const padding = await content.evaluate((el) => getComputedStyle(el).padding)
    expect(padding).toBe('16px')

    // Server-rendered badge and timestamp should be visible
    await expect(page.getByTestId('rsc-global-css-badge')).toBeVisible()
    await expect(page.getByTestId('rsc-global-css-badge')).toHaveText(
      'SERVER RENDERED',
    )
    await expect(page.getByTestId('rsc-global-css-timestamp')).toBeVisible()

    // Info grid should be rendered with server data
    await expect(page.getByTestId('rsc-global-css-info')).toBeVisible()
    await expect(page.getByTestId('rsc-global-css-node-version')).toBeVisible()
    await expect(page.getByTestId('rsc-global-css-platform')).toBeVisible()
  })

  test('HTML contains RSC content without needing hydration', async ({
    page,
  }) => {
    // Get the raw HTML response
    const response = await page.goto('/rsc-basic')
    const html = await response?.text()

    // The HTML should contain the server component content directly
    expect(html).toContain('data-testid="rsc-basic-content"')
    expect(html).toContain('SERVER RENDERED')

    // Should NOT contain loading/fallback states in the main content area
    // Note: We check the HTML doesn't have obvious loading indicators
    expect(html).toContain('Sarah Chen') // User name from server component
  })

  test('/rsc-client-preload renders client component with CSS applied without JS', async ({
    page,
  }) => {
    const response = await page.goto('/rsc-client-preload')
    const html = await response?.text()

    expect(html).toContain('rel="stylesheet"')

    // Server component wrapper should be visible
    await expect(page.getByTestId('rsc-client-preload-server')).toBeVisible()
    await expect(page.getByTestId('rsc-client-preload-title')).toHaveText(
      'Client Component Preload Test',
    )

    // Client component should be rendered in HTML (SSR)
    const widget = page.getByTestId('client-widget')
    await expect(widget).toBeVisible()

    // Verify class is scoped (hashed) - CSS modules should produce hashed class names
    const className = await widget.getAttribute('class')
    expect(className).toBeTruthy()
    expect(className).not.toBe('widget') // Should be hashed, not plain
    expect(className!.length).toBeGreaterThan(5) // Hashed names are longer

    // CRITICAL: Verify CSS styles are actually applied without JavaScript
    // This is the main test - CSS for client components inside RSC must work without JS
    // .widget has background-color: #dcfce7 which is rgb(220, 252, 231)
    const backgroundColor = await widget.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(backgroundColor).toBe('rgb(220, 252, 231)')

    // .widget has border: 2px solid #16a34a which is rgb(22, 163, 74)
    const borderColor = await widget.evaluate(
      (el) => getComputedStyle(el).borderColor,
    )
    expect(borderColor).toBe('rgb(22, 163, 74)')

    // .widget has border-radius: 8px
    const borderRadius = await widget.evaluate(
      (el) => getComputedStyle(el).borderRadius,
    )
    expect(borderRadius).toBe('8px')

    // .widget has padding: 16px
    const padding = await widget.evaluate((el) => getComputedStyle(el).padding)
    expect(padding).toBe('16px')

    // Client badge should be visible
    await expect(page.getByTestId('client-widget-badge')).toBeVisible()
    await expect(page.getByTestId('client-widget-badge')).toHaveText(
      'CLIENT COMPONENT',
    )
  })

  test('/rsc-css-preload-complex renders multiple client widgets with CSS without JS', async ({
    page,
  }) => {
    const response = await page.goto('/rsc-css-preload-complex')
    const html = await response?.text()

    expect(html).toContain('rel="stylesheet"')

    // Server component A should be visible with ClientWidgetA
    await expect(page.getByTestId('server-component-a')).toBeVisible()
    const widgetA = page.getByTestId('client-widget-a')
    await expect(widgetA).toBeVisible()

    // Verify ClientWidgetA CSS is applied (purple theme: #f3e8ff background)
    const bgColorA = await widgetA.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(bgColorA).toBe('rgb(243, 232, 255)') // #f3e8ff

    // ClientWidgetB should be visible (passed via children slot)
    const widgetB = page.getByTestId('client-widget-b')
    await expect(widgetB).toBeVisible()

    // Verify ClientWidgetB CSS is applied (teal theme: #ccfbf1 background)
    const bgColorB = await widgetB.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(bgColorB).toBe('rgb(204, 251, 241)') // #ccfbf1

    const widgetC = page.getByTestId('client-widget-c')
    await expect(widgetC).toHaveCount(0)

    const stylesheetHrefs = getStylesheetHrefs(html!)
    const linkedCss = await Promise.all(
      stylesheetHrefs.map(async (href) => {
        const response = await page.request.get(new URL(href, page.url()).href)
        return response.text()
      }),
    )
    expect(linkedCss.join('\n')).not.toContain('serverb-note')

    const note = page.getByTestId('serverb-note')
    await expect(note).toBeVisible()
    await expect(note).toHaveCSS('background-color', 'rgb(219, 234, 254)')
    await expect(note).toHaveCSS('border-color', 'rgb(59, 130, 246)')
  })
})
