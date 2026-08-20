import { expect, test } from '@playwright/test'

import {
  assertNoHorizontalOverflow,
  configureStablePage,
  waitForStablePage,
  type VisualTheme,
} from './fixtures'

for (const theme of ['light', 'dark'] satisfies VisualTheme[]) {
  test(`model distribution keeps chart and table balanced in ${theme} theme`, async ({
    page,
  }) => {
    await configureStablePage(page, { theme, authenticated: true })
    await page.goto('/console/dashboard', { waitUntil: 'domcontentloaded' })
    await waitForStablePage(page)

    const card = page.locator('[data-model-distribution-table]').locator('..')
    const chart = card.locator('[data-model-distribution-chart]')
    const table = card.locator('[data-model-distribution-table]')
    await expect(chart).toBeVisible()
    await expect(table).toBeVisible()
    await expect(table.locator('thead th')).toHaveCount(5)

    const geometry = await card.evaluate((element) => {
      const chart = element.querySelector('[data-model-distribution-chart]')
      const table = element.querySelector('[data-model-distribution-table]')
      if (!chart || !table)
        throw new Error('model distribution regions missing')
      const chartRect = chart.getBoundingClientRect()
      const tableRect = table.getBoundingClientRect()
      return {
        chartHeight: chartRect.height,
        tableHeight: tableRect.height,
        centerDelta: Math.abs(
          chartRect.top +
            chartRect.height / 2 -
            (tableRect.top + tableRect.height / 2)
        ),
      }
    })

    expect(geometry.chartHeight).toBeGreaterThanOrEqual(280)
    expect(geometry.tableHeight).toBeGreaterThan(0)
    expect(geometry.centerDelta).toBeLessThan(2)
    await assertNoHorizontalOverflow(page)

    await page.setViewportSize({ width: 390, height: 844 })
    await card.scrollIntoViewIfNeeded()
    const mobile = await card.evaluate((element) => {
      const scroll = element.querySelector('[data-model-distribution-scroll]')
      if (!scroll) throw new Error('model distribution scroll region missing')
      return {
        pageOverflow:
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
        tableOverflow: scroll.scrollWidth - scroll.clientWidth,
        chartHeight: element
          .querySelector('[data-model-distribution-chart]')
          ?.getBoundingClientRect().height,
      }
    })

    expect(mobile.pageOverflow).toBe(0)
    expect(mobile.tableOverflow).toBeGreaterThan(0)
    expect(mobile.chartHeight).toBeGreaterThanOrEqual(220)
  })
}
