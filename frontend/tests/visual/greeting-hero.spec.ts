import { expect, test } from '@playwright/test'

import {
  configureStablePage,
  waitForStablePage,
  assertNoHorizontalOverflow,
  type VisualTheme,
} from './fixtures'

const THEMES: VisualTheme[] = ['light', 'dark']

for (const theme of THEMES) {
  test(`dashboard greeting renders the time bucket and underlined name (${theme})`, async ({
    page,
  }) => {
    await configureStablePage(page, { theme })
    await page.goto('/console/dashboard')
    await waitForStablePage(page)

    const heading = page.locator('[data-handdrawn="page-hero"] h1')
    await expect(heading).toBeVisible()

    // Fixtures pin the clock to 12:00 Asia/Shanghai, so the noon bucket wins.
    await expect(heading).toHaveText('该去吃饭了，Visual Root。')

    const accent = heading.locator('span.brush-highlight')
    await expect(accent).toHaveText('Visual Root')
    await expect(accent).toHaveClass(/brush-highlight--underline/)

    // Punctuation must sit outside the painted mark.
    await expect(accent).not.toContainText('。')

    await page.screenshot({
      path: `output/greeting-hero-${theme}-desktop.png`,
      clip: { x: 0, y: 0, width: 1440, height: 420 },
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await waitForStablePage(page)
    await assertNoHorizontalOverflow(page)
    await page.screenshot({
      path: `output/greeting-hero-${theme}-mobile.png`,
      clip: { x: 0, y: 0, width: 390, height: 400 },
    })
  })
}

test('a long display name keeps the underline on each wrapped line', async ({
  page,
}) => {
  await configureStablePage(page, { theme: 'light' })
  await page.goto('/console/dashboard')
  await waitForStablePage(page)

  const accent = page.locator(
    '[data-handdrawn="page-hero"] h1 span.brush-highlight'
  )
  await accent.evaluate((node) => {
    node.textContent = '白日飞猪超长用户名用于验证换行行为是否正确'
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await waitForStablePage(page)
  await assertNoHorizontalOverflow(page)
  await page.screenshot({
    path: 'output/greeting-hero-longname-mobile.png',
    clip: { x: 0, y: 0, width: 390, height: 460 },
  })
})
