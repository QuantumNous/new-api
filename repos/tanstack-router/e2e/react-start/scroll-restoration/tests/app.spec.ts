import { expect, test } from '@playwright/test'
import { linkOptions } from '@tanstack/react-router'

test('Smoke - Renders home', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Welcome Home!' }),
  ).toBeVisible()
})

test('restores window scroll after force reload of a navigated route', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('link', { name: '/reset-scroll-false-a' }).click()
  await expect(
    page.getByRole('heading', { name: 'reset-scroll-false-a' }),
  ).toBeVisible()
  await expect
    .poll(async () =>
      page.evaluate(() => document.documentElement.scrollHeight > innerHeight),
    )
    .toBe(true)

  const scrollY = await page.evaluate(async () => {
    window.scrollTo(0, 500)
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    return window.scrollY
  })

  expect(scrollY).toBeGreaterThan(0)

  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'reset-scroll-false-a' }),
  ).toBeVisible()
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBe(scrollY)
})

test('initial hard navigation to a hash scrolls to the hash target', async ({
  page,
}) => {
  await page.goto('/hash-scroll-repro#four')
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('hash-scroll-section-four')).toBeInViewport()
  await expect(page.getByTestId('hash-scroll-section-one')).not.toBeInViewport()
})

// Test for scroll related stuff
;[
  linkOptions({ to: '/normal-page' }),
  linkOptions({ to: '/with-loader' }),
  linkOptions({ to: '/with-search', search: { where: 'footer' } }),
].forEach((options) => {
  test(`On navigate to ${options.to} (from the header), scroll should be at top`, async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByRole('link', { name: `Head-${options.to}` }).click()
    await expect(page.getByTestId('at-the-top')).toBeInViewport()
  })

  // scroll should be at the bottom on navigation after the page is loaded
  test(`On navigate via index page tests to ${options.to}, scroll should resolve at the bottom`, async ({
    page,
  }) => {
    await page.goto('/')
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
      url = `${url}?where=${options.search}`
    }
    await page.goto(`${url}#at-the-bottom`)
    await expect(page.getByTestId('at-the-bottom')).toBeInViewport()
  })
})
