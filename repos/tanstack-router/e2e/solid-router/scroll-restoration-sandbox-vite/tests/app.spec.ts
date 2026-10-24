import { expect, test } from '@playwright/test'
import { toRuntimePath } from '@tanstack/router-e2e-utils'

test('Smoke - Renders home', async ({ page }) => {
  await page.goto(toRuntimePath('/'))
  await expect(
    page.getByRole('heading', { name: 'Welcome Home!' }),
  ).toBeVisible()
})

// Test for scroll related stuff
;[
  { to: '/normal-page' },
  { to: '/lazy-page' },
  { to: '/virtual-page' },
  { to: '/lazy-with-loader-page' },
  { to: '/page-with-search', search: { where: 'footer' } },
].forEach((options) => {
  test(`On navigate to ${options.to} (from the header), scroll should be at top`, async ({
    page,
  }) => {
    await page.goto(toRuntimePath('/'))
    await page.getByRole('link', { name: `Head-${options.to}` }).click()
    await page.waitForTimeout(0)
    await expect(page.getByTestId('at-the-top')).toBeInViewport()
  })

  // scroll should be at the bottom on navigation after the page is loaded
  test(`On navigate via index page tests to ${options.to}, scroll should resolve at the bottom`, async ({
    page,
  }) => {
    await page.goto(toRuntimePath('/'))
    await page
      .getByRole('link', { name: `${options.to}#at-the-bottom` })
      .click()
    await page.waitForTimeout(0)
    await expect(page.getByTestId('at-the-bottom')).toBeInViewport()
  })

  // scroll should be at the bottom on first load
  test(`On first load of ${options.to}, scroll should resolve resolve at the bottom`, async ({
    page,
  }) => {
    let url: string = options.to
    if ('search' in options) {
      url = `${url}?where=${options.search?.where}`
    }
    await page.goto(toRuntimePath(`${url}#at-the-bottom`))
    await page.waitForTimeout(0)
    await expect(page.getByTestId('at-the-bottom')).toBeInViewport()
  })
})
