import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

const HYDRATION_WAIT = 1000
const whitelistErrors = [
  'Failed to load resource: the server responded with a status of 504',
]

test.describe('RSC Query Without Loader CSS Tests', () => {
  test.use({ whitelistErrors })

  test('render-time suspense query HTML includes resolved RSC and stylesheet links', async ({
    page,
  }) => {
    await page.goto('/rsc-query-no-loader-css')
    await page.waitForURL('/rsc-query-no-loader-css')
    const html = await page.content()

    expect(html).toBeDefined()
    expect(html).toContain('data-testid="rsc-query-no-loader-resolved"')
    expect(html).toContain('data-testid="rsc-css-modules-content"')
    expect(html).toContain('rel="stylesheet"')
    expect(html).toContain('data-rsc-css-href')
  })

  test('resolved suspense query RSC renders with CSS module styles applied', async ({
    page,
  }) => {
    await page.goto('/rsc-query-no-loader-css')
    await page.waitForURL('/rsc-query-no-loader-css')

    const container = page.getByTestId('rsc-css-modules-content')
    await expect(page.getByTestId('rsc-query-no-loader-resolved')).toBeVisible()
    await expect(container).toBeVisible()
    await expect(page.getByTestId('rsc-css-modules-title')).toContainText(
      'CSS Modules via Render-Time Suspense Query',
    )

    await expect(container).toHaveCSS('background-color', 'rgb(224, 242, 254)')
  })

  test('client-side navigation keeps streamed query CSS intact', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForURL('/')
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('nav-rsc-query-no-loader-css').click()
    await page.waitForURL('/rsc-query-no-loader-css')

    const container = page.getByTestId('rsc-css-modules-content')
    await expect(container).toBeVisible()

    await expect(container).toHaveCSS('background-color', 'rgb(224, 242, 254)')
  })
})
