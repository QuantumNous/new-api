import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Global CSS Tests', () => {
  test('RSC with global CSS hydrates without errors', async ({ page }) => {
    // Collect console errors during navigation
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    await page.goto('/rsc-global-css')
    await page.waitForURL('/rsc-global-css')
    await waitForHydration(page)

    // Verify content is visible
    await expect(page.getByTestId('rsc-global-css-content')).toBeVisible()

    // Check for hydration errors
    const hydrationErrors = consoleErrors.filter(
      (msg) =>
        msg.includes('Hydration') ||
        msg.includes('hydration') ||
        msg.includes("didn't match"),
    )
    expect(hydrationErrors).toHaveLength(0)
  })

  test('Client-side navigation to RSC with global CSS has no flash', async ({
    page,
  }) => {
    // Collect console errors during navigation
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Start from home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to RSC global CSS page via nav bar
    await page.getByTestId('nav-global-css').click()
    await page.waitForURL('/rsc-global-css')
    await page.waitForTimeout(500)

    // Verify RSC content is rendered with styles
    await expect(page.getByTestId('rsc-global-css-content')).toBeVisible()

    // Verify styles are applied immediately (no flash)
    const container = page.getByTestId('rsc-global-css-content')
    const backgroundColor = await container.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(backgroundColor).toBe('rgb(224, 242, 254)')

    // Check for hydration errors
    const hydrationErrors = consoleErrors.filter(
      (msg) =>
        msg.includes('Hydration') ||
        msg.includes('hydration') ||
        msg.includes("didn't match"),
    )
    expect(hydrationErrors).toHaveLength(0)
  })

  test('RSC renders with global CSS styles applied', async ({ page }) => {
    await page.goto('/rsc-global-css')
    await page.waitForURL('/rsc-global-css')

    // Verify RSC content is rendered
    await expect(page.getByTestId('rsc-global-css-content')).toBeVisible()
    await expect(page.getByTestId('rsc-global-css-badge')).toBeVisible()
    await expect(page.getByTestId('rsc-global-css-title')).toContainText(
      'Global CSS in Server Components',
    )

    // Verify info grid is rendered
    await expect(page.getByTestId('rsc-global-css-info')).toBeVisible()
    await expect(page.getByTestId('rsc-global-css-node-version')).toBeVisible()
    await expect(page.getByTestId('rsc-global-css-platform')).toBeVisible()

    // Verify timestamp is present
    const serverTimestamp = await page
      .getByTestId('rsc-global-css-timestamp')
      .textContent()
    expect(serverTimestamp).toContain('Fetched:')
  })

  test('Global CSS classes are NOT scoped (plain class names)', async ({
    page,
  }) => {
    await page.goto('/rsc-global-css')
    await page.waitForURL('/rsc-global-css')

    // Get the container element and verify it has a plain class name
    const container = page.getByTestId('rsc-global-css-content')
    await expect(container).toBeVisible()

    // Get the class attribute - it should be the plain class name (not hashed)
    const className = await container.getAttribute('class')
    expect(className).toBe('rsc-global-container')
  })

  test('Global CSS styles are actually applied', async ({ page }) => {
    await page.goto('/rsc-global-css')
    await page.waitForURL('/rsc-global-css')

    const container = page.getByTestId('rsc-global-css-content')
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
  })

  test('RSC with global CSS renders correctly after client-side navigation', async ({
    page,
  }) => {
    // Start from home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to RSC global CSS page via nav bar
    await page.getByTestId('nav-global-css').click()
    await page.waitForURL('/rsc-global-css')

    // Verify RSC content is rendered with styles
    await expect(page.getByTestId('rsc-global-css-content')).toBeVisible()
    await expect(page.getByTestId('rsc-global-css-title')).toContainText(
      'Global CSS in Server Components',
    )

    // Verify styles are still applied after client navigation
    const container = page.getByTestId('rsc-global-css-content')
    const backgroundColor = await container.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(backgroundColor).toBe('rgb(224, 242, 254)')
  })
})
