import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.describe('RSC Conditional CSS Tests', () => {
  test('index page links to both variants', async ({ page }) => {
    await page.goto('/rsc-css-conditional')
    await page.waitForURL('/rsc-css-conditional')

    await expect(
      page.getByTestId('rsc-css-conditional-index-title'),
    ).toBeVisible()
    await expect(
      page.getByTestId('rsc-css-conditional-link-orange'),
    ).toBeVisible()
    await expect(
      page.getByTestId('rsc-css-conditional-link-violet'),
    ).toBeVisible()
  })

  test('orange branch styles render on direct load', async ({ page }) => {
    await page.goto('/rsc-css-conditional/orange')
    await page.waitForURL('/rsc-css-conditional/orange')

    const orangePanel = page.getByTestId('rsc-conditional-orange-panel')
    await expect(page.getByTestId('rsc-css-conditional-hydrated')).toBeVisible()
    await expect(orangePanel).toBeVisible()
    await expect(page.getByTestId('rsc-conditional-violet-panel')).toHaveCount(
      0,
    )

    const bg = await orangePanel.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(bg).toBe('rgb(255, 237, 213)')
  })

  test('violet branch styles render on direct load', async ({ page }) => {
    await page.goto('/rsc-css-conditional/violet')
    await page.waitForURL('/rsc-css-conditional/violet')

    const violetPanel = page.getByTestId('rsc-conditional-violet-panel')
    await expect(page.getByTestId('rsc-css-conditional-hydrated')).toBeVisible()
    await expect(violetPanel).toBeVisible()
    await expect(page.getByTestId('rsc-conditional-orange-panel')).toHaveCount(
      0,
    )

    const bg = await violetPanel.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(bg).toBe('rgb(237, 233, 254)')
  })

  test('conditional branch switches CSS on navigation', async ({ page }) => {
    await page.goto('/rsc-css-conditional/orange')
    await page.waitForURL('/rsc-css-conditional/orange')

    await expect(page.getByTestId('rsc-conditional-orange-panel')).toBeVisible()
    await page.getByTestId('rsc-css-conditional-switch-link').click()
    await page.waitForURL('/rsc-css-conditional/violet')

    const violetPanel = page.getByTestId('rsc-conditional-violet-panel')
    await expect(violetPanel).toBeVisible()
    await expect(page.getByTestId('rsc-conditional-orange-panel')).toHaveCount(
      0,
    )

    const bg = await violetPanel.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(bg).toBe('rgb(237, 233, 254)')
  })
})
