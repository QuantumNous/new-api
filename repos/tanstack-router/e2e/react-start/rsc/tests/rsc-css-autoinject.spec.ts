import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC CSS Auto Injection Tests', () => {
  test('same-file CSS modules are auto-injected for all RSC render APIs', async ({
    page,
  }) => {
    await page.goto('/rsc-css-autoinject')
    await page.waitForURL('/rsc-css-autoinject')
    await waitForHydration(page)

    const renderable = page.getByTestId('rsc-css-autoinject-renderable')
    const composite = page.getByTestId('rsc-css-autoinject-composite')
    const flight = page.getByTestId('rsc-css-autoinject-flight')

    await expect(renderable).toBeVisible()
    await expect(composite).toBeVisible()
    await expect(flight).toBeVisible()

    for (const card of [renderable, composite, flight]) {
      await expect(card).toHaveCSS('background-color', 'rgb(204, 251, 241)')
      await expect(card).toHaveCSS('border-radius', '14px')
    }

    const html = await page.content()
    expect(html).toContain('data-rsc-css-href')
  })
})
