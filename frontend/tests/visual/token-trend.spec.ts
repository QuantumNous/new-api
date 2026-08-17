import { expect, test } from '@playwright/test'

import {
  assertNoHorizontalOverflow,
  configureStablePage,
  waitForStablePage,
} from './fixtures'

const EMPTY_TOKEN_TREND = Array.from({ length: 30 }, (_, index) => ({
  date: `2026-07-${String(index + 1).padStart(2, '0')}`,
  input: 0,
  output: 0,
  cache_create: 0,
  cache_read: 0,
  hit_rate: 0,
}))

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of ['desktop', 'mobile'] as const) {
    test(`${theme} ${viewport} token trend shows a real empty state`, async ({
      page,
    }) => {
      await page.setViewportSize(
        viewport === 'desktop'
          ? { width: 1440, height: 900 }
          : { width: 390, height: 844 }
      )
      await configureStablePage(page, { theme, authenticated: true })
      await page.route(
        /\/api\/next\/dashboard\/token-trend(?:\?.*)?$/,
        (route) =>
          route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: '',
              data: EMPTY_TOKEN_TREND,
            }),
          })
      )
      await page.goto('/console/dashboard', { waitUntil: 'domcontentloaded' })
      await waitForStablePage(page)

      const card = page.locator('[data-token-trend-card]')
      await expect(card).toBeVisible()
      await expect(card).toContainText('最近 30 天暂无 Token 使用记录')
      await expect(card.locator('canvas')).toHaveCount(0)
      await assertNoHorizontalOverflow(page)
    })
  }
}

test('token trend mounts a non-empty ECharts canvas', async ({ page }) => {
  await configureStablePage(page, { theme: 'dark', authenticated: true })
  await page.goto('/console/dashboard', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  const card = page.locator('[data-token-trend-card]')
  const canvas = card.locator('canvas')
  await expect(canvas).toBeVisible()
  const size = await canvas.evaluate((element) => {
    const target = element as HTMLCanvasElement
    return { width: target.width, height: target.height }
  })
  expect(size.width).toBeGreaterThan(0)
  expect(size.height).toBeGreaterThan(0)
})
