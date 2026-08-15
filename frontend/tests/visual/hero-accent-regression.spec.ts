import { expect, test } from '@playwright/test'

import { configureStablePage, waitForStablePage } from './fixtures'

// Wallet is the enabled pre-existing PageHero accent caller. Subscription uses
// the same component contract but is intentionally capability-disabled.
test('wallet hero keeps the ampersand swash accent', async ({ page }) => {
  await configureStablePage(page, { theme: 'light' })
  await page.goto('/console/wallet')
  await waitForStablePage(page)

  const heading = page.locator('[data-handdrawn="page-hero"] h1').first()
  await expect(heading).toBeVisible()
  await expect(heading).toContainText('&')

  const accent = heading.locator('span.brush-highlight').first()
  await expect(accent).toBeVisible()
  // The new underline modifier must not leak onto the original caller.
  await expect(accent).not.toHaveClass(/brush-highlight--underline/)

  await page.screenshot({
    path: 'output/hero-accent-wallet-light.png',
    clip: { x: 0, y: 0, width: 1440, height: 320 },
  })
})
