import { expect, test } from '@playwright/test'
import { linkOptions } from '@tanstack/react-router'
import { toRuntimePath } from '@tanstack/router-e2e-utils'

test('Smoke - Renders home', async ({ page }) => {
  await page.goto(toRuntimePath('/'))
  await expect(
    page.getByRole('heading', { name: 'Welcome Home!' }),
  ).toBeVisible()
})

test('restores the prior scroll position after browser back then forward', async ({
  page,
}) => {
  await page.goto(toRuntimePath('/'))
  await page.getByRole('link', { name: 'Head-/normal-page' }).click()
  await page.waitForURL('**/normal-page')
  await expect(page.getByTestId('at-the-top')).toBeInViewport()

  const scrollY = await page.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight)
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    return window.scrollY
  })

  expect(scrollY).toBeGreaterThan(0)
  await expect(page.getByTestId('at-the-bottom')).toBeInViewport()

  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'Welcome Home!' }),
  ).toBeVisible()

  await page.goForward()
  await page.waitForURL('**/normal-page')
  await page.waitForFunction(
    (expectedScrollY) => Math.abs(window.scrollY - expectedScrollY) <= 2,
    scrollY,
  )
  await expect(page.getByTestId('at-the-bottom')).toBeInViewport()
})

test('restores the prior scroll position after browser back navigation', async ({
  page,
}) => {
  await page.goto(toRuntimePath('/normal-page'))
  await expect(page.getByTestId('at-the-top')).toBeInViewport()

  const scrollY = await page.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight)
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    return window.scrollY
  })

  expect(scrollY).toBeGreaterThan(0)
  await expect(page.getByTestId('at-the-bottom')).toBeInViewport()

  await page.getByRole('link', { name: 'Foot-/', exact: true }).click()
  await page.waitForURL('**/')
  await expect(
    page.getByRole('heading', { name: 'Welcome Home!' }),
  ).toBeVisible()

  await page.goBack()
  await page.waitForURL('**/normal-page')
  await page.waitForFunction(
    (expectedScrollY) => Math.abs(window.scrollY - expectedScrollY) <= 2,
    scrollY,
  )
  await expect(page.getByTestId('at-the-bottom')).toBeInViewport()
})

const pages = [
  linkOptions({ to: '/normal-page' }),
  linkOptions({ to: '/lazy-page' }),
  linkOptions({ to: '/virtual-page' }),
  linkOptions({ to: '/lazy-with-loader-page' }),
  linkOptions({ to: '/page-with-search', search: { where: 'footer' } }),
] as const

pages.forEach((options, index) => {
  const from = index === 0 ? pages[1].to : pages[0].to
  test(`On navigate from ${from} to ${options.to} (from the footer), scroll should be at top`, async ({
    page,
  }) => {
    await page.goto(toRuntimePath(from))
    const link = page.getByRole('link', { name: `Foot-${options.to}` })
    await link.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await link.click()
    await expect(page.getByTestId('at-the-top')).toBeInViewport()
  })
})

// Test for scroll related stuff
pages.forEach((options) => {
  test(`On navigate to ${options.to} (from the header), scroll should be at top`, async ({
    page,
  }) => {
    await page.goto(toRuntimePath('/'))
    await page.getByRole('link', { name: `Head-${options.to}` }).click()
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
    await expect(page.getByTestId('at-the-bottom')).toBeInViewport()
  })

  // scroll should be at the bottom on first load
  test(`On first load of ${options.to}, scroll should resolve resolve at the bottom`, async ({
    page,
  }) => {
    let url: string = options.to
    if ('search' in options) {
      url = `${url}?where=${options.search.where}`
    }
    await page.goto(toRuntimePath(`${url}#at-the-bottom`))
    await expect(page.getByTestId('at-the-bottom')).toBeInViewport()
  })
})
