import { expect, test } from '@playwright/test'

import {
  assertInteractiveCentersVisible,
  assertNoHorizontalOverflow,
  configureStablePage,
  waitForStablePage,
  type VisualTheme,
} from './fixtures'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

for (const theme of ['light', 'dark'] as const satisfies VisualTheme[]) {
  for (const viewport of viewports) {
    test(`${theme} ${viewport.name} user tickets`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await configureStablePage(page, { theme, authenticated: true })
      await page.goto('/console/tickets', { waitUntil: 'domcontentloaded' })
      await waitForStablePage(page)

      await expect(
        page.getByRole('button', {
          name: 'Production request investigation',
          exact: true,
        })
      ).toBeVisible()
      await assertNoHorizontalOverflow(page)
      await assertInteractiveCentersVisible(page)

      await page
        .getByRole('button', {
          name: 'Production request investigation',
          exact: true,
        })
        .click()
      await waitForStablePage(page)

      await expect(page).toHaveURL(/\/console\/tickets\/1$/)
      await expect(page.getByText('客服', { exact: true })).toBeVisible()
      await assertNoHorizontalOverflow(page)
      await assertInteractiveCentersVisible(page)
    })

    test(`${theme} ${viewport.name} ticket management`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      await configureStablePage(page, { theme, authenticated: true })
      await page.goto('/console/ticket-management/1', {
        waitUntil: 'domcontentloaded',
      })
      await waitForStablePage(page)

      const workspace = page.getByLabel('工单处理区')
      if (viewport.name === 'desktop') {
        await expect(
          page.getByRole('heading', { name: '工单管理', exact: true })
        ).toBeVisible()
      }
      await expect(
        workspace.getByRole('heading', {
          name: 'Production request investigation',
          exact: true,
        })
      ).toBeVisible()
      await expect(
        workspace.getByText('Visual Requester', { exact: true })
      ).toBeVisible()
      await assertNoHorizontalOverflow(page)
      await assertInteractiveCentersVisible(page)
      await page.screenshot({
        path: testInfo.outputPath('ticket-management-selected.png'),
      })

      if (viewport.name === 'mobile') {
        await page.getByRole('button', { name: '返回列表' }).click()
        await expect(
          page.getByRole('complementary', { name: '工单队列' })
        ).toBeVisible()
        await assertNoHorizontalOverflow(page)
        await assertInteractiveCentersVisible(page)
      }
    })
  }
}
