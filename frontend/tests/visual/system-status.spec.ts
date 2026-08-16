import { expect, type Locator, test } from '@playwright/test'

import {
  assertNoHorizontalOverflow,
  configureStablePage,
  waitForStablePage,
  type VisualTheme,
} from './fixtures'

async function expectMetricValuesToFit(card: Locator): Promise<void> {
  for (const index of [0, 2]) {
    const fits = await card
      .locator('.grid > .min-w-0')
      .nth(index)
      .evaluate((tile) => {
        const row = tile.querySelector('p.mt-1')
        if (!row) return false
        const rowRect = row.getBoundingClientRect()
        return [...row.children].every((part) => {
          const partRect = part.getBoundingClientRect()
          return (
            partRect.left >= rowRect.left - 0.5 &&
            partRect.right <= rowRect.right + 0.5
          )
        })
      })
    expect(fits).toBe(true)
  }
}

for (const theme of ['light', 'dark'] satisfies VisualTheme[]) {
  test(`system status keeps CPU and app traffic readable in ${theme} theme`, async ({
    page,
  }) => {
    await configureStablePage(page, { theme, authenticated: true })
    await page.goto('/console/dashboard', { waitUntil: 'domcontentloaded' })
    await waitForStablePage(page)

    const card = page.locator('[data-system-status-card]')
    await expect(card).toBeVisible()
    await expect(card).toContainText('4.6%')
    await expect(card).toContainText('应用流量')
    await expect(card).toContainText('↑450 Kbps')
    await expect(card).toContainText('↓420 bps')
    await expectMetricValuesToFit(card)
    await assertNoHorizontalOverflow(page)

    await page.setViewportSize({ width: 390, height: 844 })
    await card.scrollIntoViewIfNeeded()
    await expect(card).toContainText('4.6%')
    await expect(card).toContainText('↑450 Kbps')
    await expect(card).toContainText('↓420 bps')
    await expectMetricValuesToFit(card)
    await assertNoHorizontalOverflow(page)
  })
}
