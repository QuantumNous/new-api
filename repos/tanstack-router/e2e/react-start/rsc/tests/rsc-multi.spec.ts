import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.describe('RSC Multi Tests - Multiple RSCs with mixed slots', () => {
  test('Multiple RSCs render correctly on initial load', async ({ page }) => {
    await page.goto('/rsc-multi')

    // Verify page title
    await expect(page.getByTestId('rsc-multi-title')).toHaveText(
      'News Feed - Multiple RSCs',
    )

    // Verify Component A (news article about framework)
    await expect(page.getByTestId('rsc-multi-a-content')).toContainText(
      'revolutionary new web framework',
    )
    const timestampA = await page
      .getByTestId('rsc-multi-a-timestamp')
      .textContent()
    expect(timestampA).toBeTruthy()

    // Verify Component B (news article about cloud spending)
    await expect(page.getByTestId('rsc-multi-b-content')).toContainText(
      'Enterprise cloud spending',
    )
    const timestampB = await page
      .getByTestId('rsc-multi-b-timestamp')
      .textContent()
    expect(timestampB).toBeTruthy()

    // Verify Component C (tutorial article with slots) and its children
    await expect(page.getByTestId('rsc-multi-c-content')).toContainText(
      'React Server Components',
    )
    await expect(page.getByTestId('multi-c-child')).toContainText(
      'Interactive content in slot',
    )
    const timestampC = await page
      .getByTestId('rsc-multi-c-timestamp')
      .textContent()
    expect(timestampC).toBeTruthy()
  })

  test('Multiple RSCs render correctly after client-side navigation', async ({
    page,
  }) => {
    // Start at home
    await page.goto('/')
    await expect(page.getByTestId('main-nav')).toBeVisible()

    // Navigate to multi RSC page
    await page.getByTestId('nav-multi').click()
    await page.waitForURL('/rsc-multi')

    // Verify all components render with realistic content
    await expect(page.getByTestId('rsc-multi-a-content')).toContainText(
      'revolutionary new web framework',
    )
    await expect(page.getByTestId('rsc-multi-b-content')).toContainText(
      'Enterprise cloud spending',
    )
    await expect(page.getByTestId('rsc-multi-c-content')).toContainText(
      'React Server Components',
    )
    await expect(page.getByTestId('multi-c-child')).toContainText(
      'Interactive content in slot',
    )
  })
})
