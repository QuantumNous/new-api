import { expect, test } from '@playwright/test'

import {
  assertNoHorizontalOverflow,
  configureStablePage,
  waitForStablePage,
  type VisualTheme,
} from './fixtures'

for (const theme of ['light', 'dark'] as VisualTheme[]) {
  test(`${theme} capability themes use the correct assets and fonts`, async ({
    page,
  }) => {
    await configureStablePage(page, { theme, authenticated: true })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await waitForStablePage(page)

    const market = page.locator('[data-home-channel-exchange]')
    const routing = page.locator('[data-home-token-routing]')
    await market.scrollIntoViewIfNeeded()
    await expect(market).toBeVisible()
    await expect(routing).toBeAttached()

    const titleFont = await market
      .locator('h2')
      .evaluate((element) => getComputedStyle(element).fontFamily)
    if (theme === 'light') {
      expect(titleFont).toContain('Ren2HomeTime')
    } else {
      expect(titleFont).toContain('Ren2NotoSerifSC')
      expect(titleFont).not.toContain('Ren2Home')
    }

    await expect(market.locator('.capability-backdrop img')).toHaveAttribute(
      'src',
      new RegExp(`market-${theme === 'light' ? 'day' : 'night'}`)
    )
    await expect(routing.locator('.routing-backdrop img')).toHaveAttribute(
      'src',
      new RegExp(`routing-${theme === 'light' ? 'day' : 'night'}`)
    )
    await expect(market).toHaveCSS('border-radius', '0px')
    await expect(routing).toHaveCSS('border-radius', '0px')
    await assertNoHorizontalOverflow(page)
  })
}

test('market journey binds a purchased channel into the active token', async ({
  page,
}) => {
  await configureStablePage(page, { theme: 'light', authenticated: true })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  const market = page.locator('[data-home-channel-exchange]')
  await market.scrollIntoViewIfNeeded()
  await market.getByRole('tab', { name: '卖出渠道' }).click()
  await market
    .locator('[data-listing-id="personal-vision"]')
    .getByRole('button', { name: '发布渠道' })
    .click()

  await market.getByRole('tab', { name: '买入渠道' }).click()
  const listing = market.locator('[data-listing-id="personal-vision"]')
  await listing.getByRole('button', { name: '购买渠道' }).click()
  await listing.getByRole('button', { name: /绑定到 production-key/ }).click()
  await expect(listing).toHaveAttribute('data-status', 'bound')

  const routing = page.locator('[data-home-token-routing]')
  await routing.scrollIntoViewIfNeeded()
  await expect(routing.locator('.route-item')).toHaveCount(4)
  await expect(routing.getByText('My Vision Gateway').first()).toBeVisible()
})

test('token route settings stay isolated and degraded primary fails over', async ({
  page,
}) => {
  await configureStablePage(page, { theme: 'dark', authenticated: true })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  const routing = page.locator('[data-home-token-routing]')
  await routing.scrollIntoViewIfNeeded()
  await routing.locator('[data-token-id="image-worker"]').click()
  await routing.getByRole('tab', { name: 'DIY 路由' }).click()

  const imageFirst = routing.locator('.route-item').first()
  await imageFirst.locator('input[type="range"]').fill('88')
  await imageFirst.press('ArrowDown')
  await expect(routing.locator('.route-item').first()).toHaveAttribute(
    'data-channel-id',
    'image-market'
  )

  await routing.locator('[data-token-id="production-key"]').click()
  await expect(
    routing.locator('.route-item').first().locator('input[type="range"]')
  ).toHaveValue('55')
  await routing.getByRole('button', { name: '模拟请求' }).click()
  await expect(routing.locator('[data-route-simulation]')).toHaveAttribute(
    'data-phase',
    'responded'
  )
  await expect(routing.getByText('Aurora 市场渠道').last()).toBeVisible()

  await routing.locator('[data-token-id="image-worker"]').click()
  await expect(
    routing.locator('[data-channel-id="image-official"] input[type="range"]')
  ).toHaveValue('88')
})

test('normal motion exposes the staged failover sequence', async ({ page }) => {
  await configureStablePage(page, { theme: 'dark', authenticated: true })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.locator('#app > *').first().waitFor({ state: 'visible' })
  await page.evaluate(() => document.fonts.ready)

  const routing = page.locator('[data-home-token-routing]')
  await routing.scrollIntoViewIfNeeded()
  const simulation = routing.locator('[data-route-simulation]')
  await routing.getByRole('button', { name: '模拟请求' }).click()
  await expect(simulation).toHaveAttribute('data-phase', 'sending')
  await page.waitForTimeout(440)
  await expect(simulation).toHaveAttribute('data-phase', 'failed')
  await page.waitForTimeout(330)
  await expect(simulation).toHaveAttribute('data-phase', 'switching')
  await page.waitForTimeout(440)
  await expect(simulation).toHaveAttribute('data-phase', 'responded')
})

test('capability images fall back to CSS surfaces', async ({ page }) => {
  await configureStablePage(page, { theme: 'light', authenticated: true })
  await page.route('**/capabilities/*.webp', (route) => route.abort())
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  const marketBackdrop = page.locator('.capability-backdrop')
  const routingBackdrop = page.locator('.routing-backdrop')
  await expect(marketBackdrop).toHaveClass(/is-fallback/)
  await expect(routingBackdrop).toHaveClass(/is-fallback/)
  await expect(marketBackdrop.locator('img')).toHaveCount(0)
  await expect(routingBackdrop.locator('img')).toHaveCount(0)
})

test('320px viewport has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 })
  await configureStablePage(page, { theme: 'light', authenticated: true })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)
  await page.locator('[data-home-token-routing]').scrollIntoViewIfNeeded()
  await assertNoHorizontalOverflow(page)
})

test('market CTA preserves the protected destination for guests', async ({
  page,
}) => {
  await configureStablePage(page, { theme: 'light', authenticated: false })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)
  const market = page.locator('[data-home-channel-exchange]')
  await market.scrollIntoViewIfNeeded()
  await market.getByRole('link', { name: '进入渠道市场' }).click()
  await expect(page).toHaveURL(/\/auth\/sign-in/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(
    '/console/market'
  )
})
