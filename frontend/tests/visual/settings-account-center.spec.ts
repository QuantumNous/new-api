import { expect, test } from '@playwright/test'

import {
  assertInteractiveCentersVisible,
  assertNoHorizontalOverflow,
  configureStablePage,
  type VisualTheme,
  waitForStablePage,
} from './fixtures'

const scenarios = [
  { name: 'wide', width: 1680, height: 1000 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

for (const theme of ['light', 'dark'] as VisualTheme[]) {
  for (const viewport of scenarios) {
    test(`${theme} ${viewport.name} account settings`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await configureStablePage(page, { theme, authenticated: true })

      await page.goto('/console/settings', { waitUntil: 'domcontentloaded' })
      await waitForStablePage(page)
      await expect(
        page.getByRole('heading', { name: '登录与账户', exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: '通知与偏好', exact: true })
      ).toBeVisible()
      await expect(page.getByText('演示功能', { exact: true })).toHaveCount(0)
      await expect(
        page.getByText('演示状态仅保存在当前浏览器会话', { exact: true })
      ).toHaveCount(0)
      await assertNoHorizontalOverflow(page)
      await assertInteractiveCentersVisible(page)

      const panels = await Promise.all([
        page
          .getByRole('heading', { name: '登录与账户', exact: true })
          .boundingBox(),
        page
          .getByRole('heading', { name: '通知与偏好', exact: true })
          .boundingBox(),
      ])
      expect(panels[0]).not.toBeNull()
      expect(panels[1]).not.toBeNull()
      if (viewport.name === 'wide') {
        expect(Math.abs(panels[0]!.y - panels[1]!.y)).toBeLessThanOrEqual(2)
      } else {
        expect(panels[1]!.y).toBeGreaterThan(panels[0]!.y + 600)
      }

      const scrollZone = page.locator('.scroll-zone')
      await scrollZone.evaluate((element) =>
        element.scrollTo({ top: element.scrollHeight, behavior: 'instant' })
      )
      await page.waitForTimeout(100)
      await assertInteractiveCentersVisible(page)

      await page.goto('/console/profile', { waitUntil: 'domcontentloaded' })
      await waitForStablePage(page)
      await expect(
        page.getByRole('heading', { name: '会员中心', exact: true })
      ).toBeVisible()
      await expect(
        page
          .getByRole('navigation', { name: '面包屑导航' })
          .getByText('会员中心', { exact: true })
      ).toBeVisible()
      await expect(page.locator('[data-title-side="right"]')).toHaveCount(1)
      const userMenuTrigger = page.getByRole('button', {
        name: '个人中心',
        exact: true,
      })
      await expect(userMenuTrigger).toHaveAttribute('aria-expanded', 'false')
      await userMenuTrigger.click()
      await expect(userMenuTrigger).toHaveAttribute('aria-expanded', 'true')
      await expect(page.locator('[data-user-menu-item]')).toHaveCount(5)
      await page.keyboard.press('Escape')
      await expect(userMenuTrigger).toHaveAttribute('aria-expanded', 'false')
      await expect(page.locator('[data-user-menu-item]')).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: '个人中心', exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: '账号设置', exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: '登录与账户', exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: '通知与偏好', exact: true })
      ).toBeVisible()
      await expect(page.getByText('快速导航', { exact: true })).toHaveCount(0)
      await expect(page.getByText('个人资料', { exact: true })).toHaveCount(0)
      await expect(page.getByText('账户安全', { exact: true })).toHaveCount(0)
      await expect(page.getByText('演示功能', { exact: true })).toHaveCount(0)
      await expect(
        page.getByText('演示状态仅保存在当前浏览器会话', { exact: true })
      ).toHaveCount(0)
      await assertNoHorizontalOverflow(page)
      await assertInteractiveCentersVisible(page)

      await page
        .getByRole('heading', { name: '登录与账户', exact: true })
        .scrollIntoViewIfNeeded()
      await page.waitForTimeout(100)
      await assertNoHorizontalOverflow(page)
      await assertInteractiveCentersVisible(page)
    })
  }
}
