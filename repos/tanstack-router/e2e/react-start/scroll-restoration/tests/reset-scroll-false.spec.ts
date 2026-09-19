import { expect, test } from '@playwright/test'

test('preserves carried window scroll for intermediate resetScroll=false entries', async ({
  page,
}) => {
  await page.goto('/reset-scroll-false-a')
  await page.waitForLoadState('networkidle')
  await expect(
    page.getByRole('heading', { name: 'reset-scroll-false-a' }),
  ).toBeVisible()

  const scrollY = await page.evaluate(async () => {
    window.scrollTo(0, 500)
    window.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    return window.scrollY
  })

  expect(scrollY).toBeGreaterThan(0)
  await expect(page.getByTestId('reset-scroll-false-link-8')).toBeInViewport()

  await page.getByTestId('reset-scroll-false-link-8').click()
  await expect(page).toHaveURL(/\/reset-scroll-false-b$/)
  await expect(
    page.getByRole('heading', { name: 'reset-scroll-false-b' }),
  ).toHaveCount(1)

  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBe(scrollY)
  await expect(page.getByTestId('reset-scroll-false-link-8')).toBeInViewport()

  await page.getByTestId('reset-scroll-false-link-8').click()
  await expect(page).toHaveURL(/\/reset-scroll-false-c$/)
  await expect(
    page.getByRole('heading', { name: 'reset-scroll-false-c' }),
  ).toHaveCount(1)

  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBe(scrollY)

  await page.goBack()
  await expect(page).toHaveURL(/\/reset-scroll-false-b$/)
  await expect(
    page.getByRole('heading', { name: 'reset-scroll-false-b' }),
  ).toHaveCount(1)

  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBe(scrollY)
})
