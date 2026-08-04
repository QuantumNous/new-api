import { expect, test } from '@playwright/test'

import {
  assertInteractiveCentersVisible,
  assertNoHorizontalOverflow,
  configureStablePage,
  waitForStablePage,
} from './fixtures'

test.beforeEach(async ({ page }) => {
  await configureStablePage(page, { theme: 'dark', authenticated: true })
  await page.goto('/console/dashboard', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)
})

test('usage heatmap keeps year navigation inside the card', async ({
  page,
}) => {
  const card = page.locator('[data-usage-distribution]')
  await expect(card).toBeVisible()
  await card.locator('[data-usage-period="year"]').click()
  await card.locator('[data-usage-metric="tokens"]').click()

  await expect(card.locator('[data-usage-period="year"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(card.locator('[data-usage-metric="tokens"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(card.locator('[data-usage-date]')).toHaveCount(364)
  await expect
    .poll(() =>
      card.locator('[data-usage-scroll]').evaluate((element) => ({
        left: element.scrollLeft,
        overflow: element.scrollWidth - element.clientWidth,
      }))
    )
    .toMatchObject({ left: expect.any(Number), overflow: expect.any(Number) })
  const scroll = await card
    .locator('[data-usage-scroll]')
    .evaluate((element) => ({
      left: element.scrollLeft,
      overflow: element.scrollWidth - element.clientWidth,
    }))
  expect(scroll.overflow).toBeGreaterThan(0)
  expect(scroll.left).toBeGreaterThan(0)
  await assertNoHorizontalOverflow(page)
  await assertInteractiveCentersVisible(page)
})

test('usage heatmap exposes one roving cell and moves by week', async ({
  page,
}) => {
  const card = page.locator('[data-usage-distribution]')
  const initial = card.locator('[data-usage-date][tabindex="0"]')
  await expect(initial).toHaveCount(1)
  const start = await initial.getAttribute('data-usage-date')
  await initial.focus()
  await initial.press('ArrowLeft')

  const focused = page.locator(':focus')
  await expect(focused).toHaveAttribute('data-usage-date', /\d{4}-\d{2}-\d{2}/)
  expect(await focused.getAttribute('data-usage-date')).not.toBe(start)
})

test('statistics trend supports the single-series modes', async ({ page }) => {
  await page.getByRole('tab', { name: '统计数据', exact: true }).click()
  await waitForStablePage(page)
  const trend = page.locator('[data-stats-dual-trend]')
  await expect(trend).toBeVisible()
  await trend.locator('[data-trend-mode="consume"]').click()
  await expect(trend.locator('[data-trend-mode="consume"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  )
  await expect(trend.locator('[role="img"]')).toBeVisible()
  expect(
    await page
      .locator('[data-stats-model-scroll]')
      .evaluate((element) => element.scrollWidth - element.clientWidth)
  ).toBe(0)
  await assertNoHorizontalOverflow(page)
  await assertInteractiveCentersVisible(page)
})

test('all dashboard panels remain contained at compact width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })

  const overviewStrip = page.locator('[data-overview-kpi]')
  const overviewLastCell = overviewStrip.locator(':scope > div > :last-child')
  await expect(overviewLastCell).toBeVisible()
  expect(
    await overviewLastCell.evaluate(
      (element) => element.getBoundingClientRect().width
    )
  ).toBeGreaterThan(300)

  await page.getByRole('tab', { name: '统计数据', exact: true }).click()
  await waitForStablePage(page)
  const modelScroll = page.locator('[data-stats-model-scroll]')
  await expect(modelScroll).toBeVisible()
  expect(
    await modelScroll.evaluate(
      (element) => element.scrollWidth - element.clientWidth
    )
  ).toBeGreaterThan(0)

  await page.getByRole('tab', { name: '自动路由', exact: true }).click()
  await waitForStablePage(page)
  const vendorGroups = page.locator('[data-route-vendor]')
  await expect(vendorGroups).toHaveCount(7)
  const firstGroup = vendorGroups.first()
  await firstGroup.locator('button[aria-expanded]').click()
  await expect(firstGroup.locator('[data-route-channel]')).toHaveCount(7)

  await assertNoHorizontalOverflow(page)
  await assertInteractiveCentersVisible(page)
})
