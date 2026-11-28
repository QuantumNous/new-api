import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function goToList(page: Page) {
  await page.goto('/issue-7687')
  await page.waitForLoadState('networkidle')
  await expect(
    page.getByRole('heading', { name: 'issue-7687-list' }),
  ).toBeVisible()
}

test('restores a configured nested target independently from the window', async ({
  page,
}) => {
  await goToList(page)

  const scroller = page.getByTestId('issue-7687-scroller')
  const scrollTop = await scroller.evaluate((element) => {
    element.scrollTop = 400
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
    return element.scrollTop
  })

  expect(scrollTop).toBeGreaterThan(0)
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  await page.getByTestId('issue-7687-detail-link').click()
  await expect(
    page.getByRole('heading', { name: 'issue-7687-detail' }),
  ).toBeVisible()
  await expect.poll(async () => scroller.evaluate((el) => el.scrollTop)).toBe(0)

  const outgoingWindowScrollY = await page.evaluate(() => {
    window.scrollTo(0, 600)
    window.dispatchEvent(new Event('scroll'))
    return window.scrollY
  })
  expect(outgoingWindowScrollY).toBeGreaterThan(0)

  await page.getByTestId('issue-7687-list-link').click()
  await expect(
    page.getByRole('heading', { name: 'issue-7687-list' }),
  ).toBeVisible()

  await expect
    .poll(async () => scroller.evaluate((el) => el.scrollTop))
    .toBe(scrollTop)
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0)
  await expect
    .poll(async () =>
      page.getByTestId('issue-7687-reset-probe').evaluate((el) => el.scrollTop),
    )
    .toBe(0)
})

test('resets an uncached configured target when the window restores', async ({
  page,
}) => {
  await goToList(page)

  const windowScrollY = await page.evaluate(() => {
    window.scrollTo(0, 600)
    window.dispatchEvent(new Event('scroll'))
    return window.scrollY
  })
  expect(windowScrollY).toBeGreaterThan(0)

  await page.getByTestId('issue-7687-detail-link').click()
  await expect(
    page.getByRole('heading', { name: 'issue-7687-detail' }),
  ).toBeVisible()
  await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(0)

  await page.getByTestId('issue-7687-list-link').click()
  await expect(
    page.getByRole('heading', { name: 'issue-7687-list' }),
  ).toBeVisible()

  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBe(windowScrollY)
  await expect
    .poll(async () =>
      page.getByTestId('issue-7687-reset-probe').evaluate((el) => el.scrollTop),
    )
    .toBe(0)
})

test('restores and resets nested targets independently on browser back', async ({
  page,
}) => {
  await goToList(page)

  const cachedScrollTop = await page
    .getByTestId('issue-7687-scroller')
    .evaluate(async (element) => {
      element.scrollTop = 400
      element.dispatchEvent(new Event('scroll', { bubbles: true }))
      await new Promise((resolve) => requestAnimationFrame(resolve))
      return element.scrollTop
    })
  expect(cachedScrollTop).toBeGreaterThan(0)

  await page.getByTestId('issue-7687-detail-link').click()
  await expect(
    page.getByRole('heading', { name: 'issue-7687-detail' }),
  ).toBeVisible()

  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'issue-7687-list' }),
  ).toBeVisible()

  await expect
    .poll(async () =>
      page
        .getByTestId('issue-7687-scroller')
        .evaluate((element) => element.scrollTop),
    )
    .toBe(cachedScrollTop)
  await expect
    .poll(async () =>
      page
        .getByTestId('issue-7687-reset-probe')
        .evaluate((element) => element.scrollTop),
    )
    .toBe(0)
})

test('resets a live configured target when its cached selector becomes stale', async ({
  page,
}) => {
  await goToList(page)

  const target = page.getByTestId('issue-7687-stale-selector')
  const cachedScrollTop = await target.evaluate(async (element) => {
    element.scrollTop = 80
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    return element.scrollTop
  })
  expect(cachedScrollTop).toBeGreaterThan(0)

  await page.getByTestId('issue-7687-detail-link').click()
  await expect(
    page.getByRole('heading', { name: 'issue-7687-detail' }),
  ).toBeVisible()
  await expect.poll(async () => target.evaluate((el) => el.scrollTop)).toBe(0)

  const outgoingScrollTop = await target.evaluate(async (element) => {
    element.dataset.scrollRestorationId = 'issue-7687-stale-current'
    element.scrollTop = 40
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    return element.scrollTop
  })
  expect(outgoingScrollTop).toBeGreaterThan(0)

  await page.getByTestId('issue-7687-list-link').click()
  await expect(
    page.getByRole('heading', { name: 'issue-7687-list' }),
  ).toBeVisible()

  await expect.poll(async () => target.evaluate((el) => el.scrollTop)).toBe(0)
})

test('resetScroll false preserves window and configured nested targets', async ({
  page,
}) => {
  await goToList(page)

  const positions = await page.evaluate(() => {
    const scroller = document.querySelector(
      '[data-testid="issue-7687-scroller"]',
    )
    if (!(scroller instanceof HTMLElement)) {
      throw new Error('Missing issue-7687 scroller')
    }

    scroller.scrollTop = 400
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    window.scrollTo(0, 600)
    window.dispatchEvent(new Event('scroll'))

    return { nested: scroller.scrollTop, window: window.scrollY }
  })

  expect(positions.nested).toBeGreaterThan(0)
  expect(positions.window).toBeGreaterThan(0)

  await page.getByTestId('issue-7687-detail-no-reset-link').click()
  await expect(
    page.getByRole('heading', { name: 'issue-7687-detail' }),
  ).toBeVisible()

  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBe(positions.window)
  await expect
    .poll(async () =>
      page.getByTestId('issue-7687-scroller').evaluate((el) => el.scrollTop),
    )
    .toBe(positions.nested)

  await page.getByTestId('issue-7687-list-link').click()
  await expect(
    page.getByRole('heading', { name: 'issue-7687-list' }),
  ).toBeVisible()

  const changedPositions = await page.evaluate(async () => {
    const scroller = document.querySelector(
      '[data-testid="issue-7687-scroller"]',
    )
    if (!(scroller instanceof HTMLElement)) {
      throw new Error('Missing issue-7687 scroller')
    }

    scroller.scrollTop = 200
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }))
    window.scrollTo(0, 300)
    window.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => requestAnimationFrame(resolve))

    return { nested: scroller.scrollTop, window: window.scrollY }
  })

  expect(changedPositions.nested).not.toBe(positions.nested)
  expect(changedPositions.window).not.toBe(positions.window)

  await page.getByTestId('issue-7687-detail-link').click()
  await expect(
    page.getByRole('heading', { name: 'issue-7687-detail' }),
  ).toBeVisible()
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBe(positions.window)
  await expect
    .poll(async () =>
      page.getByTestId('issue-7687-scroller').evaluate((el) => el.scrollTop),
    )
    .toBe(positions.nested)
})
