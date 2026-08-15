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
  expect(scroll.overflow).toBeGreaterThanOrEqual(0)
  const monthLabels = await card.locator('[data-usage-month]').allTextContents()
  expect(monthLabels).toEqual(expect.arrayContaining(['1月', '2月', '3月']))
  await expect(card.locator('[data-usage-draggable="true"]')).toBeVisible()

  const dragTarget = card.locator('[data-usage-draggable="true"]')
  const dragBox = await dragTarget.boundingBox()
  if (!dragBox) throw new Error('year drag area missing')
  const beforeDrag = await dragTarget.evaluate((element) => element.scrollLeft)
  await page.mouse.move(
    dragBox.x + dragBox.width / 2,
    dragBox.y + dragBox.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(
    dragBox.x + dragBox.width / 2 + 100,
    dragBox.y + dragBox.height / 2,
    { steps: 4 }
  )
  await page.mouse.up()
  const afterDrag = await dragTarget.evaluate((element) => element.scrollLeft)
  expect(afterDrag).toBeLessThan(beforeDrag)
  const layout = await card.evaluate((element) => {
    const grid = element.querySelector('.usage-dense-grid')
    const footer = element.querySelector('[data-usage-footer]')
    if (!grid || !footer) throw new Error('year layout missing')
    const cardRect = element.getBoundingClientRect()
    const gridRect = grid.getBoundingClientRect()
    const footerRect = footer.getBoundingClientRect()
    return {
      gridHeight: gridRect.height,
      footerBottomGap: cardRect.bottom - footerRect.bottom,
    }
  })
  expect(layout.gridHeight).toBeGreaterThanOrEqual(110)
  expect(layout.footerBottomGap).toBeLessThan(20)
  await assertNoHorizontalOverflow(page)
  await assertInteractiveCentersVisible(page)
})

test('usage heatmap exposes three compact periods', async ({ page }) => {
  const card = page.locator('[data-usage-distribution]')
  const expected = { month: 30, quarter: 91, year: 364 }

  await expect(card.locator('[data-usage-period="month"]')).toHaveAttribute(
    'aria-pressed',
    'true'
  )

  for (const [period, count] of Object.entries(expected)) {
    await card.locator(`[data-usage-period="${period}"]`).click()
    await expect(card.locator('[data-usage-date]')).toHaveCount(count)
    await expect(card.locator(`[data-usage-layout="${period}"]`)).toBeVisible()

    const scroll = await card
      .locator('[data-usage-scroll]')
      .evaluate((element) => element.scrollWidth - element.clientWidth)
    if (period === 'year') {
      expect(scroll).toBeGreaterThanOrEqual(0)
      const analytics = card.locator('[data-usage-analytics="bottom"]')
      await expect(analytics).toBeVisible()
      await expect(
        analytics.locator('[data-usage-segment-minimal="true"]')
      ).toHaveCount(2)
      expect((await analytics.textContent())?.trim()).toBe('')
    } else {
      expect(scroll).toBe(0)
      const analytics = card.locator('[data-usage-analytics="side"]')
      await expect(analytics).toBeVisible()
      await expect(analytics).toContainText('本段最活跃')
      await expect(analytics).toContainText('星期节律')
    }
  }
})

test('month calendar keeps roomy desktop cells and compact mobile cells', async ({
  page,
}) => {
  const card = page.locator('[data-usage-distribution]')
  await card.locator('[data-usage-period="month"]').click()

  const desktopCell = await card
    .locator('.usage-month-cell')
    .first()
    .evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
  expect(desktopCell).toEqual({ width: 42, height: 24 })

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileCell = await card
    .locator('.usage-month-cell')
    .first()
    .evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
  expect(mobileCell).toEqual({ width: 32, height: 24 })
  await assertNoHorizontalOverflow(page)
})

test('quarter heatmap and side analytics use the expanded desktop layout', async ({
  page,
}) => {
  const card = page.locator('[data-usage-distribution]')
  await card.locator('[data-usage-period="quarter"]').click()

  const desktop = await card.evaluate((element) => {
    const cell = element.querySelector('.usage-dense-cell')
    const analytics = element.querySelector('[data-usage-analytics="side"]')
    if (!cell || !analytics) throw new Error('quarter layout missing')
    const cellRect = cell.getBoundingClientRect()
    return {
      cellWidth: cellRect.width,
      cellHeight: cellRect.height,
      analyticsWidth: analytics.getBoundingClientRect().width,
    }
  })
  expect(desktop).toEqual({
    cellWidth: 21,
    cellHeight: 21,
    analyticsWidth: 272,
  })

  await page.setViewportSize({ width: 390, height: 844 })
  const mobileCell = await card
    .locator('.usage-dense-cell')
    .first()
    .evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })
  expect(mobileCell).toEqual({ width: 18, height: 18 })
  await assertNoHorizontalOverflow(page)
})

test('usage period switching keeps the overview row height stable', async ({
  page,
}) => {
  const distribution = page.locator('[data-usage-distribution]')
  const heights: number[] = []
  const measurements: Array<Record<string, number | string>> = []

  for (const period of ['month', 'quarter', 'year']) {
    await distribution.locator(`[data-usage-period="${period}"]`).click()
    await expect(
      distribution.locator(`[data-usage-layout="${period}"]`)
    ).toBeVisible()

    const row = await page.evaluate(() => {
      const distributionCard = document.querySelector(
        '[data-usage-distribution]'
      )
      const balanceCard = document.querySelector('[data-balance-card]')
      if (!distributionCard || !balanceCard) {
        throw new Error('overview row missing')
      }
      return {
        distribution: distributionCard.getBoundingClientRect().height,
        balance: balanceCard.getBoundingClientRect().height,
        content:
          distributionCard
            .querySelector('[data-usage-content]')
            ?.getBoundingClientRect().height ?? 0,
        main:
          distributionCard
            .querySelector('[data-usage-layout]')
            ?.parentElement?.getBoundingClientRect().height ?? 0,
        heatmap:
          distributionCard
            .querySelector('[data-usage-layout]')
            ?.getBoundingClientRect().height ?? 0,
        analytics:
          distributionCard
            .querySelector('[data-usage-analytics]')
            ?.getBoundingClientRect().height ?? 0,
        footer:
          distributionCard
            .querySelector('[data-usage-footer]')
            ?.getBoundingClientRect().height ?? 0,
      }
    })

    expect(
      Math.abs(row.distribution - row.balance),
      `${period} row alignment`
    ).toBeLessThan(1)
    heights.push(row.distribution)
    measurements.push({ period, ...row })
  }

  expect(
    Math.max(...heights) - Math.min(...heights),
    `period measurements: ${JSON.stringify(measurements)}`
  ).toBeLessThan(1)
})

test('balance summary distributes extra row height without a dead gap', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1840, height: 900 })
  const distribution = page.locator('[data-usage-distribution]')
  const balance = page.locator('[data-balance-card]')

  for (const period of ['month', 'quarter', 'year']) {
    await distribution.locator(`[data-usage-period="${period}"]`).click()
    await expect(
      distribution.locator(`[data-usage-layout="${period}"]`)
    ).toBeVisible()

    const gaps = await balance.evaluate((element) => {
      const meter = element.querySelector('[data-balance-usage-meter]')
      const tile = element.querySelector('[data-balance-spend-tile]')
      const action = element.querySelector('[data-balance-actions] button')
      if (!meter || !tile || !action) throw new Error('balance layout missing')

      const meterRect = meter.getBoundingClientRect()
      const tileRect = tile.getBoundingClientRect()
      const actionRect = action.getBoundingClientRect()
      return {
        above: tileRect.top - meterRect.bottom,
        below: actionRect.top - tileRect.bottom,
      }
    })

    expect(
      Math.max(gaps.above, gaps.below),
      `${period} largest gap`
    ).toBeLessThan(80)
    expect(
      Math.abs(gaps.above - gaps.below),
      `${period} gap balance`
    ).toBeLessThan(20)

    const footerBottomGap = await distribution.evaluate((element) => {
      const footer = element.querySelector('[data-usage-footer]')
      if (!footer) throw new Error('usage footer missing')
      return (
        element.getBoundingClientRect().bottom -
        footer.getBoundingClientRect().bottom
      )
    })
    expect(footerBottomGap, `${period} footer bottom gap`).toBeLessThan(20)
  }
})

test('usage distribution stays compact and contained on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const card = page.locator('[data-usage-distribution]')

  for (const period of ['month', 'quarter', 'year']) {
    await card.locator(`[data-usage-period="${period}"]`).click()
    const metrics = await card.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const scroll = element.querySelector('[data-usage-scroll]')
      return {
        height: rect.height,
        overflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        heatmapOverflow: scroll ? scroll.scrollWidth - scroll.clientWidth : 0,
      }
    })
    expect(metrics.height, `${period} card height`).toBeLessThanOrEqual(500)
    expect(metrics.overflow).toBe(0)
    if (period === 'year') expect(metrics.heatmapOverflow).toBeGreaterThan(0)
  }
})

test('usage heatmap exposes one roving cell and moves by date', async ({
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
