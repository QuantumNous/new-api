import { expect, test } from '@playwright/test'

import {
  assertNoHorizontalOverflow,
  configureStablePage,
  waitForStablePage,
} from './fixtures'

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test(`${theme} ${viewport.name} model cards expose cache pricing`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await configureStablePage(page, { theme, authenticated: true })
      await page.goto('/console/models', { waitUntil: 'domcontentloaded' })
      await waitForStablePage(page)

      const gptCard = page.locator('[data-model-name="gpt-4.1"]')
      const claudeCard = page.locator('[data-model-name="claude-sonnet-4"]')
      const geminiCard = page.locator('[data-model-name="gemini-2.5-pro"]')
      await expect(gptCard.locator('[data-model-cache-read]')).toBeVisible()
      await expect(gptCard.locator('[data-model-cache-write]')).toBeVisible()
      await expect(claudeCard.locator('[data-model-cache-write]')).toBeVisible()
      await expect(geminiCard.locator('[data-model-cache-prices]')).toHaveCount(
        0
      )

      const tokenColors = await page.evaluate(() => {
        const probe = document.createElement('div')
        probe.style.backgroundColor = 'var(--surface-solid)'
        document.body.append(probe)
        const solid = getComputedStyle(probe).backgroundColor
        probe.style.backgroundColor = 'var(--surface-table-header)'
        const tableHeader = getComputedStyle(probe).backgroundColor
        probe.remove()
        return { solid, tableHeader }
      })
      await expect(gptCard).toHaveCSS('background-color', tokenColors.solid)
      await expect(gptCard.locator('[data-model-price-panel]')).toHaveCSS(
        'background-color',
        tokenColors.tableHeader
      )
      await assertNoHorizontalOverflow(page)

      const cardGeometry = await gptCard.evaluate((card) => {
        const price = card.querySelector('[data-model-price-panel]')!
        const divider = card.querySelector('[data-model-divider]')!
        const priceRect = price.getBoundingClientRect()
        const dividerRect = divider.getBoundingClientRect()
        return {
          priceBottom: priceRect.bottom,
          dividerTop: dividerRect.top,
        }
      })
      expect(cardGeometry.priceBottom).toBeLessThanOrEqual(
        cardGeometry.dividerTop
      )
    })
  }
}

for (const theme of ['light', 'dark'] as const) {
  test(`${theme} list keeps cache prices in details`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await configureStablePage(page, { theme, authenticated: true })
    await page.goto('/console/models', { waitUntil: 'domcontentloaded' })
    await waitForStablePage(page)

    await page.getByRole('button', { name: '列表视图' }).click()
    await expect(page.locator('[data-model-cache-prices]')).toHaveCount(0)
    await expect(page.locator('[data-model-card]')).toHaveCount(3)
    await assertNoHorizontalOverflow(page)

    await page.locator('button[title="详情"]').first().click()
    const dialog = page.locator('[role="dialog"][aria-modal="true"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('[data-detail-cache-read]')).toBeVisible()
    await expect(dialog.locator('[data-detail-cache-write]')).toBeVisible()
  })
}
