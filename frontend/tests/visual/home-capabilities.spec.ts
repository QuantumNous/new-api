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

    const workbenchFont = await routing
      .locator('.routing-workbench')
      .evaluate((element) => getComputedStyle(element).fontFamily)
    const workbenchCodeFont = await routing
      .locator('.token-switcher strong')
      .first()
      .evaluate((element) => getComputedStyle(element).fontFamily)
    expect(workbenchFont).toContain('Ren2Inter')
    expect(workbenchFont).not.toContain('Ren2Home')
    expect(workbenchCodeFont).toContain('Ren2JetBrainsMono')
    expect(workbenchCodeFont).not.toContain('Ren2Home')
    await expect(routing.locator('.signal-node')).toHaveCount(4)
    await expect(routing.locator('.signal-node--channel')).toContainText(
      'CHANNEL'
    )

    await expect(market.locator('.capability-backdrop img')).toHaveAttribute(
      'src',
      new RegExp(`market-${theme === 'light' ? 'day' : 'night'}`)
    )
    await expect(routing.locator('.routing-backdrop img')).toHaveAttribute(
      'src',
      new RegExp(`routing-${theme === 'light' ? 'day' : 'night'}`)
    )
    await expect(routing.locator('.routing-backdrop img')).toHaveCSS(
      'opacity',
      theme === 'light' ? '0.12' : '0.1'
    )
    await expect(market).toHaveCSS('border-radius', '0px')
    await expect(routing).toHaveCSS('border-radius', '0px')
    expect(
      await routing
        .locator('.signal-node--gateway')
        .evaluate(
          (element) => getComputedStyle(element, '::after').animationName
        )
    ).toBe('none')
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
  await market.locator('.exchange-segments button').nth(1).click()
  await market
    .locator('[data-listing-id="personal-vision"] .exchange-action')
    .click()

  await market.locator('.exchange-segments button').nth(0).click()
  const listing = market.locator('[data-listing-id="personal-vision"]')
  await listing.locator('.exchange-action').click()
  await listing.locator('.exchange-action').click()
  await expect(listing).toHaveAttribute('data-status', 'bound')

  const routing = page.locator('[data-home-token-routing]')
  await routing.scrollIntoViewIfNeeded()
  await expect(routing.locator('.route-item')).toHaveCount(3)
  await expect(
    routing.locator(
      '.route-candidates [data-channel-id="bound-production-key-personal-vision"]'
    )
  ).toHaveAttribute('aria-pressed', 'true')
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
  await routing.locator('[data-route-mode="manual"]').click()

  const imageFirst = routing.locator('.route-item').first()
  await imageFirst.locator('.route-detail-toggle').click()
  await imageFirst.locator('input[type="range"]').fill('88')
  await imageFirst.locator('.route-item-main').press('ArrowDown')
  await expect(routing.locator('.route-item').first()).toHaveAttribute(
    'data-channel-id',
    'image-market'
  )

  await routing.locator('[data-token-id="production-key"]').click()
  const productionFirst = routing.locator('.route-item').first()
  await productionFirst.locator('.route-detail-toggle').click()
  await expect(productionFirst.locator('input[type="range"]')).toHaveValue('55')
  await routing.locator('.simulate-button').click()
  await expect(routing.locator('[data-route-simulation]')).toHaveAttribute(
    'data-phase',
    'responded'
  )
  await expect(
    routing.locator('.route-item[data-channel-id="prod-market-backup"]')
  ).toHaveClass(/is-active/)

  await routing.locator('[data-token-id="image-worker"]').click()
  const imageOfficial = routing.locator(
    '.route-item[data-channel-id="image-official"]'
  )
  await imageOfficial.locator('.route-detail-toggle').click()
  await expect(imageOfficial.locator('input[type="range"]')).toHaveValue('88')
})

test('candidate pool composes the route and exposes the empty state', async ({
  page,
}) => {
  await configureStablePage(page, { theme: 'light', authenticated: true })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  const routing = page.locator('[data-home-token-routing]')
  await routing.scrollIntoViewIfNeeded()
  const coldCandidate = routing.locator(
    '.route-candidates [data-channel-id="prod-cold-backup"]'
  )

  await expect(coldCandidate).toHaveAttribute('aria-pressed', 'false')
  await coldCandidate.click()
  await expect(coldCandidate).toHaveAttribute('aria-pressed', 'true')
  await expect(routing.locator('.route-item')).toHaveCount(3)
  await coldCandidate.click()

  const selectedIds = await routing
    .locator('.route-candidates button[aria-pressed="true"]')
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('data-channel-id'))
    )
  for (const channelId of selectedIds) {
    await routing
      .locator(`.route-candidates [data-channel-id="${channelId}"]`)
      .click()
  }

  await expect(routing.locator('[data-route-empty]')).toBeVisible()
  await routing.locator('.simulate-button').click()
  await expect(routing.locator('[data-route-simulation]')).toHaveAttribute(
    'data-phase',
    'unavailable'
  )

  await routing
    .locator('.route-candidates [data-channel-id="prod-market-backup"]')
    .click()
  await expect(routing.locator('.route-item')).toHaveCount(1)
})

test('automatic routing reorders the view without changing the DIY order', async ({
  page,
}) => {
  await configureStablePage(page, { theme: 'dark', authenticated: true })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  const routing = page.locator('[data-home-token-routing]')
  await routing.scrollIntoViewIfNeeded()
  await expect(routing.locator('.route-item').first()).toHaveAttribute(
    'data-channel-id',
    'prod-official-primary'
  )

  await routing.locator('[data-route-mode="auto"]').click()
  await expect(routing.locator('.route-item').first()).toHaveAttribute(
    'data-channel-id',
    'prod-market-backup'
  )

  await routing.locator('[data-route-mode="manual"]').click()
  await expect(routing.locator('.route-item').first()).toHaveAttribute(
    'data-channel-id',
    'prod-official-primary'
  )
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
  await routing.locator('.simulate-button').click()
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
  await market.locator('.capability-link').click()
  await expect(page).toHaveURL(/\/auth\/sign-in/)
  expect(new URL(page.url()).searchParams.get('redirect')).toBe(
    '/console/market'
  )
})
