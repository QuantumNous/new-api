import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Slot Tests - Client-side slot changes without RSC reload', () => {
  test('SSR HTML includes modulepreload links for composite route client modules', async ({
    page,
  }) => {
    const response = await page.goto('/rsc-slots')
    const html = await response?.text()
    expect(html).toBeDefined()

    const modulepreloads = Array.from(
      html!.matchAll(/<link rel="modulepreload" href="([^"]*)"/g),
      (match) => match[1]!,
    )

    expect(modulepreloads.length).toBeGreaterThan(1)
    expect(
      modulepreloads.some((href) => href.includes('/assets/')),
    ).toBeTruthy()
  })

  test('Changing child content does not reload RSC', async ({ page }) => {
    await page.goto('/rsc-slots')
    await page.waitForURL('/rsc-slots')
    await waitForHydration(page)

    // Get initial RSC timestamp
    const initialRscTimestamp = await page
      .getByTestId('rsc-slotted-timestamp')
      .textContent()

    // Verify initial child content
    await expect(page.getByTestId('child-content')).toContainText(
      'initial child',
    )

    // Change child content
    await page.getByTestId('change-child-btn').click()

    // Verify child content changed
    await expect(page.getByTestId('child-content')).toContainText(
      'Widget updated at',
    )

    // Verify RSC timestamp is unchanged (RSC was not reloaded)
    const newRscTimestamp = await page
      .getByTestId('rsc-slotted-timestamp')
      .textContent()
    expect(newRscTimestamp).toBe(initialRscTimestamp)
  })

  test('Changing footer render prop does not reload RSC', async ({ page }) => {
    await page.goto('/rsc-slots')
    await page.waitForURL('/rsc-slots')
    await waitForHydration(page)

    // Get initial RSC timestamp and footer value
    const initialRscTimestamp = await page
      .getByTestId('rsc-slotted-timestamp')
      .textContent()
    await expect(page.getByTestId('footer-content')).toContainText(
      'Computed: 42',
    )

    // Change footer multiplier
    await page.getByTestId('change-footer-btn').click()

    // Verify footer content changed
    await expect(page.getByTestId('footer-content')).toContainText(
      'Computed: 84',
    )

    // Verify RSC timestamp is unchanged
    const newRscTimestamp = await page
      .getByTestId('rsc-slotted-timestamp')
      .textContent()
    expect(newRscTimestamp).toBe(initialRscTimestamp)
  })

  test('Adding/removing extra child does not reload RSC', async ({ page }) => {
    await page.goto('/rsc-slots')
    await page.waitForURL('/rsc-slots')
    await waitForHydration(page)

    // Get initial RSC timestamp
    const initialRscTimestamp = await page
      .getByTestId('rsc-slotted-timestamp')
      .textContent()

    // Extra child should not exist initially
    await expect(page.getByTestId('extra-child-content')).not.toBeVisible()

    // Toggle to show extra child
    await page.getByTestId('toggle-extra-child-btn').click()
    await expect(page.getByTestId('extra-child-content')).toBeVisible()
    await expect(page.getByTestId('extra-child-content')).toContainText(
      'Extra widget visible!',
    )

    // Verify RSC timestamp is unchanged
    let newRscTimestamp = await page
      .getByTestId('rsc-slotted-timestamp')
      .textContent()
    expect(newRscTimestamp).toBe(initialRscTimestamp)

    // Toggle to hide extra child
    await page.getByTestId('toggle-extra-child-btn').click()
    await expect(page.getByTestId('extra-child-content')).not.toBeVisible()

    // Verify RSC timestamp is still unchanged
    newRscTimestamp = await page
      .getByTestId('rsc-slotted-timestamp')
      .textContent()
    expect(newRscTimestamp).toBe(initialRscTimestamp)
  })

  test('Multiple slot changes in sequence do not reload RSC', async ({
    page,
  }) => {
    await page.goto('/rsc-slots')
    await page.waitForURL('/rsc-slots')
    await waitForHydration(page)

    // Get initial RSC timestamp
    const initialRscTimestamp = await page
      .getByTestId('rsc-slotted-timestamp')
      .textContent()

    // Make multiple changes
    await page.getByTestId('change-child-btn').click()
    await page.getByTestId('change-footer-btn').click()
    await page.getByTestId('toggle-extra-child-btn').click()
    await page.getByTestId('change-child-btn').click()
    await page.getByTestId('change-footer-btn').click()

    // Verify all changes took effect
    await expect(page.getByTestId('child-content')).toContainText(
      'Widget updated at',
    )
    await expect(page.getByTestId('footer-content')).toContainText(
      'Computed: 126',
    ) // 42 * 3
    await expect(page.getByTestId('extra-child-content')).toBeVisible()

    // Verify RSC timestamp is unchanged through all changes
    const newRscTimestamp = await page
      .getByTestId('rsc-slotted-timestamp')
      .textContent()
    expect(newRscTimestamp).toBe(initialRscTimestamp)
  })
})
