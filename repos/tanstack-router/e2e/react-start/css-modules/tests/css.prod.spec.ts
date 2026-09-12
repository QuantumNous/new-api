import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.skip(process.env.MODE !== 'prod', 'Prod-only coverage')
test.skip(
  process.env.VITE_CSS_CODE_SPLIT !== 'false',
  'Requires cssCodeSplit=false mode',
)

test.describe('CSS modules with cssCodeSplit disabled', () => {
  test.describe('with JavaScript disabled', () => {
    test.use({ javaScriptEnabled: false })

    test('CSS modules are applied on initial page load', async ({ page }) => {
      await page.goto('/modules')

      const card = page.getByTestId('module-card')
      await expect(card).toBeVisible()

      const className = await card.getAttribute('class')
      expect(className).toBeTruthy()
      expect(className).not.toBe('card')
      expect(className!.length).toBeGreaterThan(5)

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
  })

  test('CSS modules styles persist after hydration', async ({ page }) => {
    await page.goto('/modules')

    const card = page.getByTestId('module-card')
    await expect(card).toBeVisible()

    await expect(async () => {
      const backgroundColor = await card.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      expect(backgroundColor).toBe('rgb(240, 253, 244)')
    }).toPass({ timeout: 5000 })
  })

  test('styles work correctly after client-side navigation', async ({
    page,
  }) => {
    await page.goto('/')

    const globalElement = page.getByTestId('global-styled')
    await expect(globalElement).toBeVisible()

    let backgroundColor = await globalElement.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(backgroundColor).toBe('rgb(59, 130, 246)')

    await page.getByTestId('nav-modules').click()
    await page.waitForURL('**/modules')

    const card = page.getByTestId('module-card')
    await expect(card).toBeVisible()

    await expect(async () => {
      const backgroundColor = await card.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      )
      expect(backgroundColor).toBe('rgb(240, 253, 244)')
    }).toPass({ timeout: 5000 })
  })
})
