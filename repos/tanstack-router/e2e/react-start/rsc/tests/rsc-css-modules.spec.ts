import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC CSS Modules Tests', () => {
  test('RSC with CSS modules hydrates without errors', async ({ page }) => {
    // Collect console errors during navigation
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/rsc-css-modules')
    await page.waitForURL('/rsc-css-modules')
    await waitForHydration(page)

    // Verify content is visible
    await expect(page.getByTestId('rsc-css-modules-content')).toBeVisible()

    // Check for hydration errors
    const hydrationErrors = consoleErrors.filter(
      (msg) =>
        msg.includes('Hydration') ||
        msg.includes('hydration') ||
        msg.includes("didn't match"),
    )
    expect(hydrationErrors).toHaveLength(0)
  })

  test('RSC renders with CSS module styles applied', async ({ page }) => {
    await page.goto('/rsc-css-modules')
    await page.waitForURL('/rsc-css-modules')

    // Verify RSC content is rendered
    await expect(page.getByTestId('rsc-css-modules-content')).toBeVisible()
    await expect(page.getByTestId('rsc-css-modules-badge')).toBeVisible()
    await expect(page.getByTestId('rsc-css-modules-title')).toContainText(
      'CSS Modules in Server Components',
    )

    // Verify features list is rendered
    await expect(page.getByTestId('rsc-css-modules-features')).toBeVisible()
    await expect(page.getByTestId('rsc-css-modules-feature-1')).toBeVisible()
    await expect(page.getByTestId('rsc-css-modules-feature-2')).toBeVisible()
    await expect(page.getByTestId('rsc-css-modules-feature-3')).toBeVisible()
    await expect(page.getByTestId('rsc-css-modules-feature-4')).toBeVisible()

    // Verify timestamp is present
    const serverTimestamp = await page
      .getByTestId('rsc-css-modules-timestamp')
      .textContent()
    expect(serverTimestamp).toContain('Fetched:')
  })

  test('CSS module classes are scoped (hashed)', async ({ page }) => {
    await page.goto('/rsc-css-modules')
    await page.waitForURL('/rsc-css-modules')

    // Get the container element and verify it has a scoped class name
    const container = page.getByTestId('rsc-css-modules-content')
    await expect(container).toBeVisible()

    // Get the class attribute - it should be a hashed class name from CSS modules
    const className = await container.getAttribute('class')
    expect(className).toBeTruthy()
    // CSS module class names are typically hashed, not plain "container"
    expect(className).not.toBe('container')
    // The class should contain some hash characters (CSS modules add a hash)
    expect(className!.length).toBeGreaterThan(5)
  })

  test('CSS module styles are actually applied', async ({ page }) => {
    await page.goto('/rsc-css-modules')
    await page.waitForURL('/rsc-css-modules')

    const container = page.getByTestId('rsc-css-modules-content')
    await expect(container).toBeVisible()

    // Verify the CSS is applied by checking computed styles
    const backgroundColor = await container.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    // #e0f2fe in RGB is rgb(224, 242, 254)
    expect(backgroundColor).toBe('rgb(224, 242, 254)')

    const borderRadius = await container.evaluate(
      (el) => getComputedStyle(el).borderRadius,
    )
    expect(borderRadius).toBe('8px')

    const accent = page.getByTestId('rsc-css-nested-accent')
    const accentBg = await accent.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(accentBg).toBe('rgb(220, 252, 231)')

    const accentRadius = await accent.evaluate(
      (el) => getComputedStyle(el).borderRadius,
    )
    expect(accentRadius).toBe('12px')
  })

  test('RSC with CSS modules renders correctly after client-side navigation', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    await page.getByTestId('nav-css-modules').click()
    await page.waitForURL('/rsc-css-modules')

    await expect(page.getByTestId('rsc-css-modules-content')).toBeVisible()
    await expect(page.getByTestId('rsc-css-modules-title')).toContainText(
      'CSS Modules in Server Components',
    )

    const container = page.getByTestId('rsc-css-modules-content')
    const backgroundColor = await container.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(backgroundColor).toBe('rgb(224, 242, 254)')
  })

  test('RSC CSS module styles persist across sibling client-side navigation', async ({
    page,
  }) => {
    await page.goto('/rsc-css-modules')
    await page.waitForURL('/rsc-css-modules')

    const cssModulesContent = page.getByTestId('rsc-css-modules-content')
    await expect(cssModulesContent).toBeVisible()

    const initialBackgroundColor = await cssModulesContent.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(initialBackgroundColor).toBe('rgb(224, 242, 254)')

    await page.getByTestId('nav-global-css').click()
    await page.waitForURL('/rsc-global-css')
    await expect(page.getByTestId('rsc-global-css-content')).toBeVisible()

    await page.getByTestId('nav-css-modules').click()
    await page.waitForURL('/rsc-css-modules')

    await expect(cssModulesContent).toBeVisible()

    const finalBackgroundColor = await cssModulesContent.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(finalBackgroundColor).toBe('rgb(224, 242, 254)')
  })
})
