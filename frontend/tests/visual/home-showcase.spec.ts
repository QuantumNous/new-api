import { expect, test } from '@playwright/test'

import {
  assertInteractiveCentersVisible,
  assertNoHorizontalOverflow,
  configureStablePage,
  freezeAndInspectHomeCanvas,
  waitForStablePage,
  type VisualTheme,
} from './fixtures'

const heroViewports = [
  { name: 'wide-desktop', width: 1920, height: 1080, titleSize: 64 },
  { name: 'desktop', width: 1440, height: 900, titleSize: 58.4 },
  { name: 'short-desktop', width: 1366, height: 768, titleSize: 58.4 },
  { name: 'small-desktop', width: 1024, height: 768, titleSize: 54.4 },
  { name: 'portrait-tablet', width: 768, height: 1024, titleSize: 48 },
  { name: 'large-phone', width: 430, height: 932, titleSize: 40 },
  { name: 'phone', width: 390, height: 844, titleSize: 40 },
  { name: 'short-phone', width: 360, height: 640, titleSize: 29.6 },
  { name: 'narrow-phone', width: 320, height: 720, titleSize: 34.4 },
] as const

interface ElementBounds {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

function overlapArea(a: ElementBounds, b: ElementBounds): number {
  const width = Math.max(
    0,
    Math.min(a.right, b.right) - Math.max(a.left, b.left)
  )
  const height = Math.max(
    0,
    Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  )
  return width * height
}

async function inspectHeroGeometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const bounds = (selector: string) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (!element) throw new Error(`Missing Hero element: ${selector}`)
      const rect = element.getBoundingClientRect()
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }
    }

    const hero = bounds('#hero-immersive-stage')
    const focus = Array.from(
      document.querySelectorAll<HTMLElement>('[data-hero-map-focus]')
    )
      .filter((element) => {
        const rect = element.getBoundingClientRect()
        return (
          rect.width > 0 &&
          rect.height > 0 &&
          getComputedStyle(element).display !== 'none'
        )
      })
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        }
      })[0]
    if (!focus) throw new Error('Visible Hero map focus region missing')

    const canvas =
      document.querySelector<HTMLCanvasElement>('canvas[role="img"]')
    const context = canvas?.getContext('2d')
    if (!canvas || !context) throw new Error('Hero canvas unavailable')
    const canvasRect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / canvasRect.width
    const scaleY = canvas.height / canvasRect.height
    const sampleX = Math.max(
      0,
      Math.floor((focus.left - canvasRect.left) * scaleX)
    )
    const sampleY = Math.max(
      0,
      Math.floor((focus.top - canvasRect.top) * scaleY)
    )
    const sampleWidth = Math.min(
      canvas.width - sampleX,
      Math.max(1, Math.floor(focus.width * scaleX))
    )
    const sampleHeight = Math.min(
      canvas.height - sampleY,
      Math.max(1, Math.floor(focus.height * scaleY))
    )
    const pixels = context.getImageData(
      sampleX,
      sampleY,
      sampleWidth,
      sampleHeight
    ).data
    const colors = new Set<string>()
    let minLuma = 255
    let maxLuma = 0
    const sampleStride = Math.max(4, Math.floor(pixels.length / 16_000 / 4) * 4)
    for (let offset = 0; offset < pixels.length; offset += sampleStride) {
      const red = pixels[offset]!
      const green = pixels[offset + 1]!
      const blue = pixels[offset + 2]!
      colors.add(`${red >> 3},${green >> 3},${blue >> 3}`)
      const luma = 0.2126 * red + 0.7152 * green + 0.0722 * blue
      minLuma = Math.min(minLuma, luma)
      maxLuma = Math.max(maxLuma, luma)
    }

    const nav = document.querySelector<HTMLElement>('.app-navbar nav')
    if (!nav) throw new Error('Home navigation missing')
    const navStyle = getComputedStyle(nav)
    const ticker = document.querySelector<HTMLElement>(
      '.signal-console__ticker'
    )
    const tickerVisible =
      ticker !== null && getComputedStyle(ticker).display !== 'none'

    return {
      viewportHeight: innerHeight,
      hero,
      focus,
      copy: bounds('.hero-copy-glow'),
      title: bounds('.hero-title'),
      actions: bounds('.hero-actions'),
      primaryCta: bounds('.hero-cta-primary'),
      integration: bounds('.hero-integration-boundary'),
      ticker: tickerVisible ? bounds('.signal-console__ticker') : null,
      titleSize: Number.parseFloat(
        getComputedStyle(document.querySelector('.hero-title')!).fontSize
      ),
      navWidth: nav.getBoundingClientRect().width,
      navMaxWidth: Number.parseFloat(navStyle.maxWidth),
      focusPixels: {
        distinct: colors.size,
        contrast: maxLuma - minLuma,
      },
    }
  })
}

for (const theme of ['light', 'dark'] as VisualTheme[]) {
  for (const viewport of heroViewports) {
    test(`${theme} ${viewport.name} Hero geometry`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await configureStablePage(page, { theme, authenticated: true })
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      await waitForStablePage(page)
      await freezeAndInspectHomeCanvas(page)

      const geometry = await inspectHeroGeometry(page)
      expect(
        Math.abs(geometry.hero.height - geometry.viewportHeight)
      ).toBeLessThanOrEqual(1)
      expect(geometry.titleSize).toBeCloseTo(viewport.titleSize, 1)
      expect(geometry.primaryCta.height).toBeGreaterThanOrEqual(44)
      expect(geometry.focusPixels.distinct).toBeGreaterThan(8)
      expect(geometry.focusPixels.contrast).toBeGreaterThan(18)

      for (const bounds of [
        geometry.focus,
        geometry.copy,
        geometry.title,
        geometry.actions,
        geometry.integration,
      ]) {
        expect(bounds.left).toBeGreaterThanOrEqual(geometry.hero.left - 1)
        expect(bounds.right).toBeLessThanOrEqual(geometry.hero.right + 1)
        expect(bounds.top).toBeGreaterThanOrEqual(geometry.hero.top - 1)
        expect(bounds.bottom).toBeLessThanOrEqual(geometry.hero.bottom + 1)
      }

      expect(overlapArea(geometry.focus, geometry.copy)).toBe(0)
      expect(overlapArea(geometry.actions, geometry.integration)).toBe(0)
      if (geometry.ticker) {
        expect(overlapArea(geometry.ticker, geometry.integration)).toBe(0)
        expect(geometry.ticker.bottom).toBeLessThanOrEqual(
          geometry.hero.bottom + 1
        )
      }
      if (viewport.width >= 1280) {
        expect(geometry.navMaxWidth).toBeCloseTo(1280, 0)
        expect(geometry.navWidth).toBeCloseTo(1280, 0)
      }

      await assertInteractiveCentersVisible(page)
      await assertNoHorizontalOverflow(page)

      const runtime = page.locator('#home-runtime')
      await runtime.scrollIntoViewIfNeeded()
      await expect(page.locator('[data-home-request-total]')).toHaveText('752')
      await expect(page.locator('.runtime-trend polyline')).toHaveAttribute(
        'points',
        /,/
      )
      const runtimeBounds = await runtime.evaluate((section) => {
        const bounds = (selector: string) => {
          const element = section.querySelector<HTMLElement>(selector)
          if (!element) throw new Error(`Missing runtime element: ${selector}`)
          const rect = element.getBoundingClientRect()
          return {
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }
        }
        const overflow = (selector: string) => {
          const element = section.querySelector<HTMLElement>(selector)
          if (!element) throw new Error(`Missing runtime element: ${selector}`)
          return element.scrollWidth - element.clientWidth
        }
        const rect = section.getBoundingClientRect()
        return {
          section: {
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            left: rect.left,
          },
          uptime: bounds('.runtime-ledger-panel--uptime'),
          requests: bounds('.runtime-ledger-panel--requests'),
          uptimeHeading: bounds(
            '.runtime-ledger-panel--uptime .runtime-ledger-heading'
          ),
          clock: bounds('.runtime-clock'),
          availability: bounds('.runtime-availability'),
          total: bounds('[data-home-request-total]'),
          caption: bounds('.runtime-request-caption'),
          trend: bounds('.runtime-trend'),
          totalOverflow: overflow('[data-home-request-total]'),
          trendOverflow: overflow('.runtime-trend'),
          uptimeHeadingOverflow: overflow(
            '.runtime-ledger-panel--uptime .runtime-ledger-heading'
          ),
        }
      })
      for (const bounds of [
        runtimeBounds.uptime,
        runtimeBounds.requests,
        runtimeBounds.uptimeHeading,
        runtimeBounds.clock,
        runtimeBounds.availability,
        runtimeBounds.total,
        runtimeBounds.caption,
        runtimeBounds.trend,
      ]) {
        expect(bounds.left).toBeGreaterThanOrEqual(
          runtimeBounds.section.left - 1
        )
        expect(bounds.right).toBeLessThanOrEqual(
          runtimeBounds.section.right + 1
        )
        expect(bounds.top).toBeGreaterThanOrEqual(runtimeBounds.section.top - 1)
        expect(bounds.bottom).toBeLessThanOrEqual(
          runtimeBounds.section.bottom + 1
        )
      }
      expect(runtimeBounds.totalOverflow).toBeLessThanOrEqual(1)
      expect(runtimeBounds.trendOverflow).toBeLessThanOrEqual(1)
      expect(runtimeBounds.uptimeHeadingOverflow).toBeLessThanOrEqual(1)
      expect(overlapArea(runtimeBounds.total, runtimeBounds.trend)).toBe(0)
      expect(overlapArea(runtimeBounds.caption, runtimeBounds.trend)).toBe(0)
      if (viewport.width > 900) {
        expect(runtimeBounds.uptime.right).toBeLessThanOrEqual(
          runtimeBounds.requests.left + 1
        )
        expect(
          Math.abs(runtimeBounds.uptime.top - runtimeBounds.requests.top)
        ).toBeLessThanOrEqual(1)
      } else {
        expect(runtimeBounds.uptime.bottom).toBeLessThanOrEqual(
          runtimeBounds.requests.top + 1
        )
      }
      await assertNoHorizontalOverflow(page)
    })
  }
}

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

      const heroMetrics = await page
        .locator('#hero-immersive-stage')
        .evaluate((element) => {
          const bounds = element.getBoundingClientRect()
          return {
            height: bounds.height,
            minHeight: Number.parseFloat(getComputedStyle(element).minHeight),
            viewportHeight: window.innerHeight,
          }
        })
      expect(heroMetrics.minHeight).toBeCloseTo(heroMetrics.viewportHeight, 0)
      expect(heroMetrics.height).toBeGreaterThanOrEqual(
        heroMetrics.viewportHeight
      )

      await assertInteractiveCentersVisible(page)
      await expect(page.locator('html')).toHaveClass(/hero-scrollbar-hidden/)
      expect(
        await page.evaluate(
          () => getComputedStyle(document.documentElement).scrollbarWidth
        )
      ).toBe('none')

      const showcase = page.locator('.home-showcase')
      await showcase.scrollIntoViewIfNeeded()
      await expect(showcase).toBeVisible()
      await expect(page.locator('[data-home-request-total]')).toHaveText('752')
      await expect(page.locator('.runtime-trend polyline')).toBeVisible()
      await assertNoHorizontalOverflow(page)
      await expect(page.locator('.scroll-activity-indicator')).toHaveCount(0)
      await expect(page.locator('[data-home-progress-dots]')).toHaveCount(1)
      await expect(page.locator('[data-home-progress-dot]')).toHaveCount(2)
      if (viewport === 'desktop') {
        await expect(page.locator('[data-home-progress-dots]')).toBeVisible()
        expect(
          await page
            .locator('[data-home-progress-dot][aria-current="location"] span')
            .evaluate((element) => getComputedStyle(element).animationName)
        ).toBe('none')
      } else {
        await expect(page.locator('[data-home-progress-dots]')).toBeHidden()
      }

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
              loaded: ['Ren2HomeTime', 'Ren2HomeSketch', 'Ren2HomeStamp'],
            }
          : {
              display: 'Ren2NotoSerifSC',
              stamp: 'Ren2JetBrainsMono',
              hand: 'Ren2JetBrainsMono',
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
    })
  }
}

test('home runtime workbench remains self-contained', async ({ page }) => {
  await configureStablePage(page, { theme: 'light', authenticated: true })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  await expect(page.locator('.runtime-clock-group')).toHaveCount(4)
  await expect(page.locator('.runtime-flap')).toHaveCount(9)
  await expect(page.locator('.runtime-availability-bar')).toHaveCount(7)
  await expect(page.locator('.runtime-availability strong')).toContainText(
    '99.95%'
  )
  await page.locator('#home-runtime').scrollIntoViewIfNeeded()
  await expect(page.locator('[data-home-request-total]')).toHaveText('752')
  await expect(page.locator('.runtime-trend polyline')).toHaveCount(1)
  await expect(page.locator('[data-home-channel-exchange]')).toHaveCount(0)
  await expect(page.locator('[data-home-token-routing]')).toHaveCount(0)
  await expect(page.getByText('渠道供应，也能自由买卖')).toHaveCount(0)
  await expect(page.getByText('每一枚令牌，都有自己的路由表')).toHaveCount(0)
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
  const trendOverflow = await page
    .locator('.runtime-trend')
    .evaluate((element) => element.scrollWidth - element.clientWidth)
  expect(trendOverflow).toBeLessThanOrEqual(1)
})

const requestTotalViewports = [
  { name: 'narrow-phone', width: 320, height: 720 },
  { name: 'small-desktop', width: 1024, height: 768 },
] as const

for (const theme of ['light', 'dark'] as VisualTheme[]) {
  for (const viewport of requestTotalViewports) {
    test(`${theme} ${viewport.name} long home request total stays contained`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport)
      await configureStablePage(page, { theme, authenticated: true })
      const requests24h = Number.MAX_SAFE_INTEGER
      await page.route('**/api/home/metrics', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: '',
            data: {
              available: true,
              requests_24h: requests24h,
              hourly_requests: [requests24h, ...Array(23).fill(0)],
              generated_at: 1_785_103_200,
            },
          }),
        })
      )
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      await waitForStablePage(page)
      await page.locator('#home-runtime').scrollIntoViewIfNeeded()

      const total = page.locator('[data-home-request-total]')
      await expect(total).toHaveText('9,007,199,254,740,991')
      const geometry = await total.evaluate((element) => {
        const totalBounds = element.getBoundingClientRect()
        const panel = element.closest<HTMLElement>(
          '.runtime-ledger-panel--requests'
        )!
        const panelBounds = panel.getBoundingClientRect()
        const trendBounds = panel
          .querySelector<HTMLElement>('.runtime-trend')!
          .getBoundingClientRect()
        return {
          totalLeft: totalBounds.left,
          totalRight: totalBounds.right,
          panelLeft: panelBounds.left,
          panelRight: panelBounds.right,
          overflow: element.scrollWidth - element.clientWidth,
          trendLeft: trendBounds.left,
        }
      })
      expect(geometry.totalLeft).toBeGreaterThanOrEqual(geometry.panelLeft - 1)
      expect(geometry.totalRight).toBeLessThanOrEqual(geometry.panelRight + 1)
      expect(geometry.overflow).toBeLessThanOrEqual(1)
      expect(geometry.totalRight).toBeLessThanOrEqual(geometry.trendLeft + 1)
      await assertNoHorizontalOverflow(page)
    })
  }
}

test('home progress dots navigate and track page position', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await configureStablePage(page, { theme: 'light', authenticated: true })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  const dots = page.locator('[data-home-progress-dot]')
  await expect(dots).toHaveCount(2)
  await expect(dots.nth(0)).toHaveAttribute('aria-current', 'location')

  await dots.nth(1).click()
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 2_000 })
    .toBeGreaterThan(0)
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'location')
  await expect(page.locator('#home-runtime')).toBeInViewport()

  await dots.nth(0).focus()
  await page.keyboard.press('Enter')
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 2_000 })
    .toBeLessThan(2)
  await expect(dots.nth(0)).toHaveAttribute('aria-current', 'location')

  await dots.nth(1).focus()
  await page.keyboard.press('Space')
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 2_000 })
    .toBeGreaterThan(0)
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'location')
})

test('home progress dots activate the runtime section at a tall viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1400 })
  await configureStablePage(page, { theme: 'light', authenticated: true })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  const dots = page.locator('[data-home-progress-dot]')
  await dots.nth(1).click()
  await expect(dots.nth(1)).toHaveAttribute('aria-current', 'location')
  await expect(page.locator('#home-runtime')).toBeInViewport()
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
  await configureStablePage(page, {
    theme: 'dark',
    authenticated: true,
    clockStepMs: 1_000,
  })
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
      { timeout: 5_000, intervals: [50, 100, 150, 200] }
    )
    .toBe(true)
})
