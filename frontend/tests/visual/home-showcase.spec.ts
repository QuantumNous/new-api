import { expect, test } from '@playwright/test'

import {
  assertInteractiveCentersVisible,
  assertNoHorizontalOverflow,
  configureStablePage,
  freezeAndInspectHomeCanvas,
  waitForStablePage,
  type VisualTheme,
} from './fixtures'

for (const theme of ['light', 'dark'] as VisualTheme[]) {
  for (const viewport of ['desktop', 'mobile'] as const) {
    test(`${theme} ${viewport} home showcase`, async ({ page }) => {
      await page.setViewportSize(
        viewport === 'desktop'
          ? { width: 1440, height: 900 }
          : { width: 390, height: 844 }
      )
      await configureStablePage(page, { theme, authenticated: true })
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      await waitForStablePage(page)
      await freezeAndInspectHomeCanvas(page)

      await assertInteractiveCentersVisible(page)

      const showcase = page.locator('.home-showcase')
      await showcase.scrollIntoViewIfNeeded()
      await expect(showcase).toBeVisible()
      await assertNoHorizontalOverflow(page)
      await expect(page.locator('.showcase-dot-rail')).toHaveCount(0)

      const pageLevelRadii = await page
        .locator(
          '.landing-shell, #hero-immersive-stage, .home-showcase, .home-band'
        )
        .evaluateAll((elements) =>
          elements.map(
            (element) => getComputedStyle(element).borderTopLeftRadius
          )
        )
      expect(pageLevelRadii.every((radius) => radius === '0px')).toBe(true)

      const displayFont = await page
        .locator('.hero-title')
        .first()
        .evaluate((element) => getComputedStyle(element).fontFamily)
      const expectedFonts =
        theme === 'light'
          ? {
              display: 'Ren2HomeTime',
              stamp: 'Ren2HomeStamp',
              hand: 'Ren2HomeSketch',
              request: 'Ren2HomeTime',
              loaded: ['Ren2HomeTime', 'Ren2HomeSketch', 'Ren2HomeStamp'],
            }
          : {
              display: 'Ren2NotoSerifSC',
              stamp: 'Ren2JetBrainsMono',
              hand: 'Ren2JetBrainsMono',
              request: 'Ren2Inter',
              loaded: [
                'Ren2NotoSerifSC',
                'Ren2JetBrainsMono',
                'Ren2NotoSansSC',
                'Ren2Inter',
              ],
            }
      expect(displayFont).toContain(expectedFonts.display)
      expect(
        await page.evaluate(
          (font) => document.fonts.check(`16px ${font}`),
          expectedFonts.display
        )
      ).toBe(true)
      expect(
        await page.evaluate(
          (fonts) =>
            fonts.every((name) => document.fonts.check(`16px ${name}`)),
          expectedFonts.loaded
        )
      ).toBe(true)

      expect(
        await page
          .locator('.runtime-flap')
          .first()
          .evaluate((element) => getComputedStyle(element).fontFamily)
      ).toContain(expectedFonts.stamp)
      expect(
        await page
          .locator('.runtime-clock-group small')
          .first()
          .evaluate((element) => getComputedStyle(element).fontFamily)
      ).toContain(expectedFonts.hand)
      expect(
        await page
          .locator('.runtime-request-total')
          .evaluate((element) => getComputedStyle(element).fontFamily)
      ).toContain(expectedFonts.request)

      if (theme === 'dark') {
        await expect(page.locator('.runtime-ledger-panel')).toHaveCount(2)
        await expect(page.locator('.runtime-ledger-panel').first()).toHaveCSS(
          'border-radius',
          '16px'
        )
        await expect(
          page.locator('.runtime-ledger-panel').first()
        ).not.toHaveCSS('box-shadow', 'none')
        await expect(page.locator('.runtime-band')).toHaveCSS(
          'background-image',
          'none'
        )
      }

      expect(
        await page
          .locator('.runtime-flap')
          .first()
          .evaluate((element) => getComputedStyle(element).animationName)
      ).toBe('none')
      await expect(showcase).toHaveScreenshot(
        `${theme}-${viewport}-home-showcase.png`,
        { animations: 'disabled' }
      )
    })
  }
}

test('home runtime workbench remains self-contained', async ({ page }) => {
  await configureStablePage(page, { theme: 'light', authenticated: true })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  await expect(page.locator('.runtime-clock-group')).toHaveCount(4)
  await expect(page.locator('.runtime-request-total')).toContainText('32,132')
  await expect(page.locator('.runtime-availability-bar')).toHaveCount(7)
  await expect(page.locator('.runtime-trend polyline')).toHaveCount(1)
})

test('home showcase remains intact at narrow mobile width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await configureStablePage(page, { theme: 'light', authenticated: true })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  const showcase = page.locator('.home-showcase')
  await showcase.scrollIntoViewIfNeeded()
  await assertNoHorizontalOverflow(page)

  const clockOverflow = await page
    .locator('.runtime-clock')
    .evaluate((element) => element.scrollWidth - element.clientWidth)
  expect(clockOverflow).toBeLessThanOrEqual(1)
})

test('homepage display fonts stay scoped away from the console', async ({
  page,
}) => {
  await configureStablePage(page, { theme: 'light', authenticated: true })
  await page.goto('/console', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  const consoleFont = await page
    .locator("[data-handdrawn-scope='console']")
    .evaluate((element) => getComputedStyle(element).fontFamily)
  expect(consoleFont).not.toContain('Ren2Home')
})

test('runtime motion starts only when motion is allowed', async ({ page }) => {
  await configureStablePage(page, { theme: 'dark', authenticated: true })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.locator('#app > *').first().waitFor({ state: 'visible' })
  await page.evaluate(() => document.fonts.ready)

  await page.locator('.home-showcase').scrollIntoViewIfNeeded()

  const animationName = await page
    .locator('.runtime-flap')
    .first()
    .evaluate((element) => getComputedStyle(element).animationName)
  expect(animationName).toBe('runtime-flap-tick')

  const statusAnimations = await page
    .locator('.runtime-status-dot')
    .evaluate((element) => ({
      dot: getComputedStyle(element).animationName,
      ripple: getComputedStyle(element, '::after').animationName,
    }))
  expect(statusAnimations).toEqual({
    dot: 'runtime-status-breathe',
    ripple: 'runtime-status-ripple',
  })

  await expect
    .poll(
      async () => {
        const activeLeaf = page.locator('.runtime-flap.is-flipping').first()
        if ((await activeLeaf.count()) === 0) return false
        return (
          (await activeLeaf.locator('.flap-leaf--previous-top').count()) ===
            1 &&
          (await activeLeaf.locator('.flap-leaf--previous-bottom').count()) ===
            1 &&
          (await activeLeaf.locator('.flap-leaf--next-bottom').count()) === 1
        )
      },
      { timeout: 3_000 }
    )
    .toBe(true)
})
