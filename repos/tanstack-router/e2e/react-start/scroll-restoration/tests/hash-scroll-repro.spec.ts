import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function goToRepro(page: Page) {
  await page.goto('/hash-scroll-repro#five')
  await page.waitForLoadState('networkidle')
  // Wait for the browser to scroll to #five
  await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 5000 })
  await expect(page.getByTestId('hash-scroll-section-five')).toBeInViewport()
}

async function scrollUpFromHashTarget(page: Page) {
  const scrollY = await page.evaluate(async () => {
    window.scrollBy(0, -500)
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
    return window.scrollY
  })

  expect(scrollY).toBeGreaterThan(0)

  // Verify #five is no longer centered in the viewport (we scrolled up from it)
  await page.waitForFunction(() => {
    const section = document.querySelector(
      '[data-testid="hash-scroll-section-five"]',
    )

    if (!(section instanceof HTMLElement)) {
      return false
    }

    return section.getBoundingClientRect().top > window.innerHeight / 2
  })

  return scrollY
}

test('hover preloading another route does not scroll back to the current hash', async ({
  page,
}) => {
  await goToRepro(page)
  const scrollYBeforeHover = await scrollUpFromHashTarget(page)

  const preloadResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/hash-scroll-about') && response.ok(),
  )

  // Hover the About link to trigger preload
  await page.getByTestId('hash-scroll-about-link').hover()
  await preloadResponse

  // Give any erroneous scroll a chance to happen
  await page.waitForTimeout(300)

  const scrollYAfterHover = await page.evaluate(() => window.scrollY)
  expect(scrollYAfterHover).toBe(scrollYBeforeHover)
})

test('router.invalidate does not scroll back to the current hash', async ({
  page,
}) => {
  await goToRepro(page)
  const scrollYBeforeInvalidate = await scrollUpFromHashTarget(page)
  const invalidateCountBefore = await page
    .getByTestId('hash-scroll-repro-invalidate-count')
    .textContent()

  // Click invalidate
  await page.getByTestId('hash-scroll-invalidate-button').click()

  // Wait for the invalidation cycle to complete
  await expect(
    page.getByTestId('hash-scroll-repro-invalidate-count'),
  ).not.toHaveText(invalidateCountBefore ?? '')

  // Give any erroneous scroll a chance to happen
  await page.waitForTimeout(300)

  const scrollYAfterInvalidate = await page.evaluate(() => window.scrollY)
  expect(scrollYAfterInvalidate).toBe(scrollYBeforeInvalidate)
})

test('hash navigation wins over stale same-tab scroll restoration entries', async ({
  page,
}) => {
  await goToRepro(page)
  const staleScrollY = await scrollUpFromHashTarget(page)

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(
    page.getByTestId('hash-scroll-repro-invalidate-count'),
  ).toBeVisible()

  await page.getByTestId('hash-scroll-section-one-link').click()
  await expect(page.getByTestId('hash-scroll-section-one')).toBeInViewport()

  await expect(
    page.getByTestId('hash-scroll-section-five'),
  ).not.toBeInViewport()

  const scrollYAfterHashNavigation = await page.evaluate(() => window.scrollY)
  expect(scrollYAfterHashNavigation).toBeLessThan(staleScrollY)
})

test('hash navigation still runs when only nested scroll entries restore', async ({
  page,
}) => {
  await goToRepro(page)

  const nestedScrollTop = await page.evaluate(() => {
    const nested = document.querySelector('[data-testid="hash-scroll-nested"]')
    if (!(nested instanceof HTMLElement)) {
      throw new Error('Missing nested scroller')
    }

    nested.scrollTop = 80
    window.dispatchEvent(new PageTransitionEvent('pagehide'))
    return nested.scrollTop
  })

  expect(nestedScrollTop).toBeGreaterThan(0)

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(
    page.getByTestId('hash-scroll-repro-invalidate-count'),
  ).toBeVisible()

  await page.getByTestId('hash-scroll-section-one-link').click()
  await expect(page.getByTestId('hash-scroll-section-one')).toBeInViewport()

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const nested = document.querySelector(
          '[data-testid="hash-scroll-nested"]',
        )
        return nested instanceof HTMLElement ? nested.scrollTop : 0
      })
    })
    .toBe(nestedScrollTop)
})

test('hash navigation scrolls when resetScroll is false', async ({ page }) => {
  await page.goto('/hash-scroll-repro#one')
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('hash-scroll-section-one')).toBeInViewport()

  const scrollYBeforeHashNavigation = await page.evaluate(() => window.scrollY)

  await page.getByTestId('hash-scroll-section-four-no-reset-link').click()

  await expect(page).toHaveURL(/#four$/)
  await expect(page.getByTestId('hash-scroll-section-four')).toBeInViewport()
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(scrollYBeforeHashNavigation)
})
