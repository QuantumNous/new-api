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

test('hash navigation wins when the destination invalidates in a layout effect', async ({
  page,
}) => {
  await goToRepro(page)
  const staleScrollY = await scrollUpFromHashTarget(page)

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(
    page.getByTestId('hash-scroll-repro-invalidate-count'),
  ).toHaveText('Invalidate count: 0')

  await page.getByTestId('hash-scroll-layout-invalidate-link').click()
  await expect(page).toHaveURL(/invalidateOnMount=true#one$/)
  await expect(
    page.getByTestId('hash-scroll-repro-invalidate-count'),
  ).toHaveText('Invalidate count: 1')

  await expect(page.getByTestId('hash-scroll-section-one')).toBeInViewport()
  await expect(
    page.getByTestId('hash-scroll-section-five'),
  ).not.toBeInViewport()

  const scrollYAfterHashNavigation = await page.evaluate(() => window.scrollY)
  expect(scrollYAfterHashNavigation).toBeLessThan(staleScrollY)
})

test('hash navigation still runs when a configured nested target restores', async ({
  page,
}) => {
  await goToRepro(page)

  const nested = page.getByTestId('hash-scroll-nested')
  const cachedScrollTop = await nested.evaluate(async (element) => {
    element.scrollTop = 80
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    return element.scrollTop
  })

  expect(cachedScrollTop).toBeGreaterThan(0)

  await page.getByTestId('hash-scroll-about-link').click()
  await expect(
    page.getByRole('heading', { name: 'hash-scroll-about' }),
  ).toBeVisible()

  await page.getByTestId('hash-scroll-restore-link').click()
  await expect(page.getByTestId('hash-scroll-section-one')).toBeInViewport()

  await expect
    .poll(async () => nested.evaluate((element) => element.scrollTop))
    .toBe(cachedScrollTop)
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

test('hash navigation does not reset configured nested targets', async ({
  page,
}) => {
  await goToRepro(page)

  const resetTarget = page.getByTestId('hash-scroll-reset-target')
  const scrollTop = await resetTarget.evaluate((element) => {
    element.scrollTop = 80
    return element.scrollTop
  })
  expect(scrollTop).toBeGreaterThan(0)

  await page.getByTestId('hash-scroll-section-one-link').click()
  await expect(page).toHaveURL(/#one$/)
  await expect(page.getByTestId('hash-scroll-section-one')).toBeInViewport()
  await expect
    .poll(async () => resetTarget.evaluate((el) => el.scrollTop))
    .toBe(scrollTop)
})

test('hash navigation does not carry configured targets into a different key', async ({
  page,
}) => {
  await goToRepro(page)

  const resetTarget = page.getByTestId('hash-scroll-reset-target')
  const sourceScrollTop = await resetTarget.evaluate(async (element) => {
    element.scrollTop = 80
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
    await new Promise((resolve) => requestAnimationFrame(resolve))
    return element.scrollTop
  })
  expect(sourceScrollTop).toBeGreaterThan(0)

  await page.getByTestId('hash-scroll-different-key-link').click()
  await expect(page).toHaveURL(/scrollKey=destination#one$/)
  await expect(page.getByTestId('hash-scroll-section-one')).toBeInViewport()
  await expect
    .poll(async () => resetTarget.evaluate((element) => element.scrollTop))
    .toBe(sourceScrollTop)

  await page.getByTestId('hash-scroll-about-link').click()
  await expect(
    page.getByRole('heading', { name: 'hash-scroll-about' }),
  ).toBeVisible()

  await page.getByTestId('hash-scroll-destination-link').click()
  await expect(page).toHaveURL(/scrollKey=destination$/)
  await expect
    .poll(async () =>
      page
        .getByTestId('hash-scroll-reset-target')
        .evaluate((element) => element.scrollTop),
    )
    .toBe(0)
})
