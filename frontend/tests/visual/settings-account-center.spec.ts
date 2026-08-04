import { expect, test } from '@playwright/test'

import {
  assertInteractiveCentersVisible,
  assertNoHorizontalOverflow,
  configureStablePage,
  type VisualTheme,
  waitForStablePage,
} from './fixtures'

const scenarios = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

for (const theme of ['light', 'dark'] as VisualTheme[]) {
  for (const viewport of scenarios) {
    test(`${theme} ${viewport.name} account settings`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      await configureStablePage(page, { theme, authenticated: true })

      await page.goto('/console/settings', { waitUntil: 'domcontentloaded' })
      await waitForStablePage(page)
      await expect(
        page.getByRole('heading', { name: '账户与安全', exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: '偏好与通知', exact: true })
      ).toBeVisible()
      await assertNoHorizontalOverflow(page)
      await assertInteractiveCentersVisible(page)

      const panels = await Promise.all([
        page
          .getByRole('heading', { name: '账户与安全', exact: true })
          .boundingBox(),
        page
          .getByRole('heading', { name: '偏好与通知', exact: true })
          .boundingBox(),
      ])
      expect(panels[0]).not.toBeNull()
      expect(panels[1]).not.toBeNull()
      if (viewport.name === 'desktop') {
        expect(Math.abs(panels[0]!.y - panels[1]!.y)).toBeLessThanOrEqual(2)
      } else {
        expect(panels[1]!.y).toBeGreaterThan(panels[0]!.y + 600)
      }

      const settingsPath = testInfo.outputPath(
        `${theme}-${viewport.name}-settings.png`
      )
      await page.screenshot({ fullPage: true, path: settingsPath })
      await testInfo.attach(`${theme}-${viewport.name}-settings`, {
        path: settingsPath,
        contentType: 'image/png',
      })

      const scrollZone = page.locator('.scroll-zone')
      await scrollZone.evaluate((element) =>
        element.scrollTo({ top: element.scrollHeight, behavior: 'instant' })
      )
      await page.waitForTimeout(100)
      await assertInteractiveCentersVisible(page)
      const settingsBottomPath = testInfo.outputPath(
        `${theme}-${viewport.name}-settings-bottom.png`
      )
      await page.screenshot({ path: settingsBottomPath })
      await testInfo.attach(`${theme}-${viewport.name}-settings-bottom`, {
        path: settingsBottomPath,
        contentType: 'image/png',
      })

      await page.goto('/console/profile', { waitUntil: 'domcontentloaded' })
      await waitForStablePage(page)
      await expect(
        page.getByRole('heading', { name: '账户与安全', exact: true })
      ).toBeVisible()
      await expect(
        page.getByRole('heading', { name: '偏好与通知', exact: true })
      ).toBeVisible()
      await expect(page.getByText('快速导航', { exact: true })).toHaveCount(0)
      await expect(page.getByText('个人资料', { exact: true })).toHaveCount(0)
      await expect(page.getByText('账户安全', { exact: true })).toHaveCount(0)
      await assertNoHorizontalOverflow(page)
      await assertInteractiveCentersVisible(page)
      const profilePath = testInfo.outputPath(
        `${theme}-${viewport.name}-profile.png`
      )
      await page.screenshot({ fullPage: true, path: profilePath })
      await testInfo.attach(`${theme}-${viewport.name}-profile`, {
        path: profilePath,
        contentType: 'image/png',
      })

      await page
        .getByRole('heading', { name: '账户与安全', exact: true })
        .scrollIntoViewIfNeeded()
      await page.waitForTimeout(100)
      await assertNoHorizontalOverflow(page)
      await assertInteractiveCentersVisible(page)
      const profileSettingsPath = testInfo.outputPath(
        `${theme}-${viewport.name}-profile-settings.png`
      )
      await page.screenshot({ path: profileSettingsPath })
      await testInfo.attach(`${theme}-${viewport.name}-profile-settings`, {
        path: profileSettingsPath,
        contentType: 'image/png',
      })
    })
  }
}
