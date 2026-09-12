import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import type { APIRequestContext, Page } from '@playwright/test'

async function clickAndExpectCount(
  page: Page,
  buttonTestId: string,
  countTestId: string,
  count: string,
) {
  await expect(page.getByTestId(buttonTestId)).toHaveAttribute(
    'data-hydrated',
    'true',
  )
  await page.getByTestId(buttonTestId).click()
  await expect(page.getByTestId(countTestId)).toHaveText(count)
}

async function clickIntentAndExpectReplayedCount(
  page: Page,
  buttonTestId: string,
  countTestId: string,
  count: string,
) {
  await expectRouteToStayUnhydrated(page, buttonTestId)
  await page.getByTestId(buttonTestId).click()
  await expect(page.getByTestId(buttonTestId)).toHaveAttribute(
    'data-hydrated',
    'true',
  )
  await expect(page.getByTestId(countTestId)).toHaveText(count)
}

async function clickToHydrateThenClickAndExpectIncrement(
  page: Page,
  buttonTestId: string,
  countTestId: string,
) {
  await expectRouteToStayUnhydrated(page, buttonTestId)
  await page.getByTestId(buttonTestId).click()
  await expect(page.getByTestId(buttonTestId)).toHaveAttribute(
    'data-hydrated',
    'true',
  )
  const previousCount = Number(
    await page.getByTestId(countTestId).textContent(),
  )
  await page.getByTestId(buttonTestId).click()
  await expect
    .poll(async () => Number(await page.getByTestId(countTestId).textContent()))
    .toBe(previousCount + 1)
}

async function hoverIntentAndExpectCount(
  page: Page,
  buttonTestId: string,
  countTestId: string,
  count: string,
) {
  await expectRouteToStayUnhydrated(page, buttonTestId)
  await page.mouse.move(0, 0)
  await page.getByTestId(buttonTestId).hover()
  await clickAndExpectCount(page, buttonTestId, countTestId, count)
}

async function dispatchHydrationIntent(
  page: Page,
  buttonTestId: string,
  eventName: string,
) {
  await page.getByTestId(buttonTestId).evaluate((element, eventName) => {
    const marker = element.closest('[data-ts-hydrate-id]')

    if (!marker) {
      throw new Error('Expected Hydrate marker to exist')
    }

    marker.dispatchEvent(
      new Event(eventName, { bubbles: true, cancelable: true }),
    )
  }, eventName)
}

async function trackBoundaryStability(page: Page, buttonTestId: string) {
  await page.getByTestId(buttonTestId).evaluate((element, testId) => {
    const marker = element.closest('[data-ts-hydrate-id]')

    if (!(marker instanceof HTMLElement)) {
      throw new Error('Expected Hydrate marker to exist')
    }

    const win = window as typeof window & {
      __hydrateBoundaryVisualGapCount?: number
      __hydrateBoundaryMaxScrollDelta?: number
      __hydrateBoundaryStabilityDone?: boolean
    }
    const hasBoundaryButton = () =>
      Array.from(marker.querySelectorAll('[data-testid]')).some(
        (child) => child.getAttribute('data-testid') === testId,
      )
    const hasHydratedBoundaryButton = () =>
      Array.from(marker.querySelectorAll('[data-testid]')).some(
        (child) =>
          child.getAttribute('data-testid') === testId &&
          child.getAttribute('data-hydrated') === 'true',
      )
    const initialScrollY = window.scrollY

    win.__hydrateBoundaryVisualGapCount = 0
    win.__hydrateBoundaryMaxScrollDelta = 0
    win.__hydrateBoundaryStabilityDone = false

    let frameCount = 0
    let hydratedFrameCount = 0
    let observer: MutationObserver | undefined
    const recordScroll = () => {
      win.__hydrateBoundaryMaxScrollDelta = Math.max(
        win.__hydrateBoundaryMaxScrollDelta ?? 0,
        Math.abs(window.scrollY - initialScrollY),
      )

      if (hasHydratedBoundaryButton()) hydratedFrameCount++

      frameCount++
      if (hydratedFrameCount >= 10 || frameCount >= 300) {
        observer?.disconnect()
        win.__hydrateBoundaryStabilityDone = true
        return
      }

      requestAnimationFrame(recordScroll)
    }

    observer = new MutationObserver(() => {
      if (!hasBoundaryButton()) {
        win.__hydrateBoundaryVisualGapCount!++
      }
    })
    observer.observe(marker, { childList: true })

    requestAnimationFrame(recordScroll)
  }, buttonTestId)
}

async function expectBoundaryStable(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __hydrateBoundaryStabilityDone?: boolean
            }
          ).__hydrateBoundaryStabilityDone ?? false,
      ),
    )
    .toBe(true)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __hydrateBoundaryVisualGapCount?: number
            }
          ).__hydrateBoundaryVisualGapCount ?? 0,
      ),
    )
    .toBe(0)
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __hydrateBoundaryMaxScrollDelta?: number
            }
          ).__hydrateBoundaryMaxScrollDelta ?? 0,
      ),
    )
    .toBeLessThanOrEqual(1)
}

async function expectRouteToStayUnhydrated(
  page: Page,
  buttonTestId: string,
  duration = 250,
) {
  await expect(page.getByTestId(buttonTestId)).toHaveAttribute(
    'data-hydrated',
    'false',
  )
  await page.waitForTimeout(duration)
  await expect(page.getByTestId(buttonTestId)).toHaveAttribute(
    'data-hydrated',
    'false',
  )
}

async function scrollToBoundary(page: Page, buttonTestId: string) {
  const button = page.getByTestId(buttonTestId)
  for (let attempt = 0; attempt < 3; attempt++) {
    await button.evaluate((element) => {
      element.scrollIntoView({ block: 'center', inline: 'nearest' })
    })

    await page.waitForTimeout(100)
    const isVisible = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight
    })

    if (isVisible) return
  }

  await expect(button).toBeInViewport()
}

async function expectCssProperty(
  page: Page,
  testId: string,
  property: string,
  value: string,
) {
  await expect
    .poll(() =>
      page.getByTestId(testId).evaluate((element, propertyName) => {
        return getComputedStyle(element).getPropertyValue(propertyName)
      }, property),
    )
    .toBe(value)
}

function htmlContainsText(html: string, text: string) {
  const pattern = text.split(' ').join('(?:\\s|<!-- -->)+')
  expect(html).toMatch(new RegExp(pattern))
}

function getModulePreloadHrefs(html: string) {
  return Array.from(html.matchAll(/<link\b[^>]*>/g), (match) => match[0])
    .filter((tag) => /\brel="modulepreload"/.test(tag))
    .map((tag) => tag.match(/\bhref="([^"]+)"/)?.[1])
    .filter((href): href is string => !!href)
}

async function modulePreloadContentsContain(
  request: APIRequestContext,
  hrefs: Array<string>,
  marker: string,
) {
  for (const href of hrefs) {
    const response = await request.get(href)
    if (!response.ok()) continue

    const text = await response.text()
    if (text.includes(marker)) return true
  }

  return false
}

async function resourceContentsContain(
  page: Page,
  request: APIRequestContext,
  marker: string,
  filter: (url: string) => boolean,
) {
  const resourceUrls = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => entry.name),
  )

  return modulePreloadContentsContain(
    request,
    resourceUrls.filter(filter),
    marker,
  )
}

async function documentModulePreloadHrefs(page: Page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel~="modulepreload"]'),
      (link) => link.href,
    ),
  )
}

function isHydrateBoundaryResource(url: string) {
  return (
    url.includes('/assets/components-') ||
    url.includes('/assets/js/async/') ||
    url.includes('/static/js/async/')
  )
}

function isClientJavaScriptResource(url: string) {
  return (
    url.includes('/assets/') ||
    url.includes('/static/js/') ||
    url.includes('/static/js/async/')
  )
}

async function expectClientRouterReady(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(
          (
            globalThis as typeof globalThis & {
              __TSR_ROUTER__?: unknown
            }
          ).__TSR_ROUTER__,
        ),
      ),
    )
    .toBe(true)
}

async function gotoEnhanced(page: Page, search = '') {
  await page.goto(`/enhanced${search}`)
  await expectClientRouterReady(page)
}

test.describe('component-level Hydrate runtime strategies', () => {
  test('renders SSR HTML and hydrates each runtime when appropriately', async ({
    page,
    request,
  }) => {
    await page.goto('/components')

    await expect(page.getByTestId('component-heading')).toHaveText(
      'Component Deferred Hydration',
    )

    await clickAndExpectCount(
      page,
      'component-load-button',
      'component-load-count',
      '1',
    )
    await clickAndExpectCount(
      page,
      'component-idle-button',
      'component-idle-count',
      '1',
    )
    await expect(
      resourceContentsContain(page, request, 'component-visible', (url) =>
        isHydrateBoundaryResource(url),
      ),
    ).resolves.toBe(false)
    await expectRouteToStayUnhydrated(page, 'component-visible-button')
    await scrollToBoundary(page, 'component-visible-button')
    await clickAndExpectCount(
      page,
      'component-visible-button',
      'component-visible-count',
      '1',
    )
    await expect
      .poll(() =>
        resourceContentsContain(page, request, 'component-visible', (url) =>
          isHydrateBoundaryResource(url),
        ),
      )
      .toBe(true)
    await clickAndExpectCount(
      page,
      'component-media-button',
      'component-media-count',
      '1',
    )
    await hoverIntentAndExpectCount(
      page,
      'component-interaction-button',
      'component-interaction-count',
      '1',
    )
    await expect(page.getByTestId('component-on-hydrated-count')).toHaveText(
      '0',
    )
    await expectRouteToStayUnhydrated(page, 'component-custom-single-button')
    await page.getByTestId('component-custom-single-button').hover()
    await expectRouteToStayUnhydrated(page, 'component-custom-single-button')
    await page.getByTestId('component-custom-single-button').click()
    await expectRouteToStayUnhydrated(page, 'component-custom-single-button')
    await dispatchHydrationIntent(
      page,
      'component-custom-single-button',
      'dblclick',
    )
    await expect(
      page.getByTestId('component-custom-single-button'),
    ).toHaveAttribute('data-hydrated', 'true')
    await expect(page.getByTestId('component-on-hydrated-count')).toHaveText(
      '1',
    )
    await clickAndExpectCount(
      page,
      'component-custom-single-button',
      'component-custom-single-count',
      '1',
    )
    await expect(page.getByTestId('component-on-hydrated-count')).toHaveText(
      '1',
    )
    await expectRouteToStayUnhydrated(page, 'component-custom-multi-button')
    await dispatchHydrationIntent(
      page,
      'component-custom-multi-button',
      'contextmenu',
    )
    await clickAndExpectCount(
      page,
      'component-custom-multi-button',
      'component-custom-multi-count',
      '1',
    )
    await expectRouteToStayUnhydrated(page, 'component-condition-button')
    await page.getByTestId('component-enable-condition').click()
    await clickAndExpectCount(
      page,
      'component-condition-button',
      'component-condition-count',
      '1',
    )
    await scrollToBoundary(page, 'component-click-replay-button')
    await expectRouteToStayUnhydrated(page, 'component-click-replay-button')
    await trackBoundaryStability(page, 'component-click-replay-button')
    await page.getByTestId('component-click-replay-button').click()
    await expect(
      page.getByTestId('component-click-replay-button'),
    ).toHaveAttribute('data-hydrated', 'true')
    await expectBoundaryStable(page)
    await expect(page.getByTestId('component-click-replay-count')).toHaveText(
      '1',
    )
    await expectRouteToStayUnhydrated(page, 'component-prefetch-button')
    await expect(
      resourceContentsContain(page, request, 'component-prefetch', (url) =>
        isHydrateBoundaryResource(url),
      ),
    ).resolves.toBe(false)
    await page.mouse.move(0, 0)
    await page.getByTestId('component-prefetch-button').hover()
    await expect(page.getByTestId('component-prefetch-button')).toHaveAttribute(
      'data-hydrated',
      'false',
    )
    await expect
      .poll(() =>
        resourceContentsContain(page, request, 'component-prefetch', (url) =>
          isHydrateBoundaryResource(url),
        ),
      )
      .toBe(true)
    await expect(page.getByTestId('component-prefetch-button')).toHaveAttribute(
      'data-hydrated',
      'false',
    )
    await page.getByTestId('component-prefetch-button').click()
    await expect(page.getByTestId('component-prefetch-button')).toHaveAttribute(
      'data-hydrated',
      'true',
    )
    await expect(page.getByTestId('component-prefetch-count')).toHaveText('1')
    await hoverIntentAndExpectCount(
      page,
      'component-nested-child-button',
      'component-nested-child-count',
      '1',
    )

    await page.getByTestId('component-never-button').click()
    await expect(page.getByTestId('component-never-count')).toHaveText('0')
  })

  test('replays click after another interaction boundary hydrates first', async ({
    page,
  }) => {
    await page.goto('/components')
    await expectClientRouterReady(page)

    await scrollToBoundary(page, 'component-custom-multi-button')
    await expectRouteToStayUnhydrated(page, 'component-custom-multi-button')
    await page.getByTestId('component-custom-multi-button').click({
      button: 'right',
    })
    await expect(
      page.getByTestId('component-custom-multi-button'),
    ).toHaveAttribute('data-hydrated', 'true')

    await scrollToBoundary(page, 'component-click-replay-button')
    await expectRouteToStayUnhydrated(page, 'component-click-replay-button')
    await trackBoundaryStability(page, 'component-click-replay-button')
    await page.getByTestId('component-click-replay-button').click()
    await expect(
      page.getByTestId('component-click-replay-button'),
    ).toHaveAttribute('data-hydrated', 'true')
    await expectBoundaryStable(page)
    await expect(page.getByTestId('component-click-replay-count')).toHaveText(
      '1',
    )
  })

  test('keeps bottom scroll stable when a condition boundary hydrates', async ({
    page,
  }) => {
    await page.goto('/components')
    await expectClientRouterReady(page)
    await expectRouteToStayUnhydrated(page, 'component-condition-button')

    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight)
    })
    await page.waitForTimeout(100)
    await expect(
      page.getByTestId('component-enable-condition'),
    ).toBeInViewport()

    await trackBoundaryStability(page, 'component-condition-button')
    await page.getByTestId('component-enable-condition').click()
    await expect(
      page.getByTestId('component-condition-button'),
    ).toHaveAttribute('data-hydrated', 'true')
    await expectBoundaryStable(page)
    await clickAndExpectCount(
      page,
      'component-condition-button',
      'component-condition-count',
      '1',
    )
  })

  test('shows fallback during a client-only mount while the child suspends', async ({
    page,
  }) => {
    await page.goto('/components')
    await expect(page.getByTestId('component-load-button')).toHaveAttribute(
      'data-hydrated',
      'true',
    )
    await page.getByTestId('component-show-client-fallback').click()

    await expect(page.getByTestId('component-client-fallback')).toHaveText(
      'client fallback',
    )
    await expect(page.getByTestId('component-fallback-child')).toHaveText(
      'fallback child',
    )
    await expect(page.getByTestId('component-client-fallback')).toHaveCount(0)
  })
})

test.describe('enhanced Hydrate API combinations', () => {
  test('server renders dynamic markers without evaluating client-only callbacks or prefetch functions', async ({
    request,
  }) => {
    const response = await request.get('/enhanced?dynamic=interaction')
    const html = await response.text()

    expect(response.ok()).toBe(true)
    htmlContainsText(html, 'Enhanced Hydrate APIs')
    htmlContainsText(html, 'conditional dynamic')
    expect(html).toContain('data-ts-hydrate-when="dynamic"')
    expect(html).not.toContain('missing-element')
  })

  test('dynamic when functions hydrate and replay interaction events', async ({
    page,
  }) => {
    await gotoEnhanced(page, '?dynamic=interaction')
    await expect(page.getByTestId('enhanced-heading')).toHaveText(
      'Enhanced Hydrate APIs',
    )
    await clickIntentAndExpectReplayedCount(
      page,
      'enhanced-dynamic-interaction-button',
      'enhanced-dynamic-interaction-count',
      '1',
    )

    await expectRouteToStayUnhydrated(
      page,
      'enhanced-dynamic-conditional-button',
    )
    await page.getByTestId('enhanced-dynamic-conditional-button').hover()
    await expectRouteToStayUnhydrated(
      page,
      'enhanced-dynamic-conditional-button',
    )
    await clickIntentAndExpectReplayedCount(
      page,
      'enhanced-dynamic-conditional-button',
      'enhanced-dynamic-conditional-count',
      '1',
    )
  })

  test('procedural prefetch can block hydration, preload the split chunk, and prepare query-like work', async ({
    page,
    request,
  }) => {
    await gotoEnhanced(page)
    await expect(
      resourceContentsContain(
        page,
        request,
        'enhanced-procedural-split-child',
        isClientJavaScriptResource,
      ),
    ).resolves.toBe(false)

    await expectRouteToStayUnhydrated(page, 'enhanced-procedural-split-button')
    await expect(page.getByTestId('enhanced-split-wait-reason')).toHaveText(
      'waiting',
    )
    await dispatchHydrationIntent(
      page,
      'enhanced-procedural-split-button',
      'pointerover',
    )
    await expect(page.getByTestId('enhanced-split-query')).toHaveText('element')
    await expect(page.getByTestId('enhanced-split-wait-reason')).toHaveText(
      'prefetch',
    )
    await expect(page.getByTestId('enhanced-split-preload')).toHaveText('done')
    await expect
      .poll(() =>
        resourceContentsContain(
          page,
          request,
          'enhanced-procedural-split-child',
          isClientJavaScriptResource,
        ),
      )
      .toBe(true)

    await page.getByTestId('enhanced-procedural-split-button').click()
    await expect(
      page.getByTestId('enhanced-procedural-split-button'),
    ).toHaveAttribute('data-hydrated', 'false')
    await expect(
      page.getByTestId('enhanced-procedural-split-count'),
    ).toHaveText('0')
    await page.getByTestId('enhanced-release-split-prefetch').click()
    await expect(
      page.getByTestId('enhanced-procedural-split-button'),
    ).toHaveAttribute('data-hydrated', 'true')
    await expect(
      page.getByTestId('enhanced-procedural-split-count'),
    ).toHaveText('1')
    await expect(page.getByTestId('enhanced-split-query')).toHaveText('done')
  })

  test('function prefetch supports fire-and-forget work and waitFor hydrate-first resolution', async ({
    page,
  }) => {
    await gotoEnhanced(page)

    await expect(page.getByTestId('enhanced-fire-wait-reason')).toHaveText(
      'waiting',
    )
    await dispatchHydrationIntent(
      page,
      'enhanced-fire-and-forget-button',
      'pointerover',
    )
    await expect(page.getByTestId('enhanced-fire-wait-reason')).toHaveText(
      'prefetch',
    )
    await expect(page.getByTestId('enhanced-fire-status')).toHaveText('started')
    await clickIntentAndExpectReplayedCount(
      page,
      'enhanced-fire-and-forget-button',
      'enhanced-fire-and-forget-count',
      '1',
    )
    await expect(page.getByTestId('enhanced-fire-query')).toHaveText('idle')
    await page.getByTestId('enhanced-release-fire-prefetch').click()
    await expect(page.getByTestId('enhanced-fire-query')).toHaveText('done')

    await clickIntentAndExpectReplayedCount(
      page,
      'enhanced-hydrate-first-button',
      'enhanced-hydrate-first-count',
      '1',
    )
    await expect(page.getByTestId('enhanced-hydrate-first-reason')).toHaveText(
      'hydrate',
    )
  })

  test('split=false procedural prefetch blocks hydration without requiring a child preload chunk', async ({
    page,
  }) => {
    await gotoEnhanced(page)

    await expectRouteToStayUnhydrated(page, 'enhanced-runtime-only-button')
    await expect(page.getByTestId('enhanced-runtime-wait-reason')).toHaveText(
      'waiting',
    )
    await dispatchHydrationIntent(
      page,
      'enhanced-runtime-only-button',
      'pointerover',
    )
    await expect(page.getByTestId('enhanced-runtime-wait-reason')).toHaveText(
      'prefetch',
    )
    await page.getByTestId('enhanced-runtime-only-button').click()
    await expect(
      page.getByTestId('enhanced-runtime-only-button'),
    ).toHaveAttribute('data-hydrated', 'false')
    await expect(page.getByTestId('enhanced-runtime-only-count')).toHaveText(
      '0',
    )
    await page.getByTestId('enhanced-release-runtime-prefetch').click()
    await expect(page.getByTestId('enhanced-runtime-status')).toHaveText(
      'ready',
    )
    await expect(
      page.getByTestId('enhanced-runtime-only-button'),
    ).toHaveAttribute('data-hydrated', 'true')
    await expect(page.getByTestId('enhanced-runtime-only-count')).toHaveText(
      '1',
    )
  })

  test('procedural prefetch aborts waiters and signals when boundaries unmount', async ({
    page,
  }) => {
    await gotoEnhanced(page)

    await expectRouteToStayUnhydrated(page, 'enhanced-wait-abort-button')
    await expect(page.getByTestId('enhanced-wait-abort-reason')).toHaveText(
      'waiting',
    )
    await page.getByTestId('enhanced-hide-wait-abort').click()
    await expect(page.getByTestId('enhanced-wait-abort-reason')).toHaveText(
      'abort',
    )

    await expect(page.getByTestId('enhanced-abort-status')).toHaveText(
      'listening',
    )
    await page.getByTestId('enhanced-hide-abort').click()
    await expect(page.getByTestId('enhanced-abort-status')).toHaveText(
      'aborted',
    )
  })

  test('nested dynamic interaction boundaries delegate through outer boundaries', async ({
    page,
  }) => {
    await gotoEnhanced(page)

    await clickToHydrateThenClickAndExpectIncrement(
      page,
      'enhanced-dynamic-nested-button',
      'enhanced-dynamic-nested-count',
    )
    await clickToHydrateThenClickAndExpectIncrement(
      page,
      'enhanced-cross-file-nested-button',
      'enhanced-cross-file-nested-count',
    )
  })
})

test.describe('Hydrate CSS delivery', () => {
  test('ships CSS for deferred, never, shared, and nested boundaries without JavaScript', async ({
    browser,
    request,
  }) => {
    const response = await request.get('/css')
    const html = await response.text()

    htmlContainsText(html, 'CSS Deferred Hydration')
    htmlContainsText(html, 'Outer CSS')
    htmlContainsText(html, 'Deferred CSS')
    htmlContainsText(html, 'Never CSS')
    htmlContainsText(html, 'Nested CSS')

    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()

    try {
      await page.goto('/css')

      await expect(page.getByTestId('css-heading')).toHaveText(
        'CSS Deferred Hydration',
      )
      await expect(page.getByTestId('css-deferred')).toHaveText('Deferred CSS')
      await expect(page.getByTestId('css-never')).toHaveText('Never CSS')
      await expect(page.getByTestId('css-nested')).toHaveText('Nested CSS')

      await expectCssProperty(page, 'css-outer', 'color', 'rgb(12, 34, 56)')
      await expectCssProperty(
        page,
        'css-deferred',
        'background-color',
        'rgb(23, 45, 67)',
      )
      await expectCssProperty(page, 'css-never', 'color', 'rgb(45, 67, 89)')
      await expectCssProperty(
        page,
        'css-shared-outer',
        'border-top-color',
        'rgb(98, 76, 54)',
      )
      await expectCssProperty(
        page,
        'css-deferred',
        'border-top-color',
        'rgb(98, 76, 54)',
      )
      await expectCssProperty(
        page,
        'css-nested',
        'border-left-color',
        'rgb(67, 89, 123)',
      )
      await expectCssProperty(page, 'css-nested', 'border-left-width', '5px')
    } finally {
      await context.close()
    }
  })

  test('renders deferred content and omits never content after client-side navigation', async ({
    page,
  }) => {
    await page.goto('/')
    await expectClientRouterReady(page)
    await page.getByRole('link', { name: 'CSS', exact: true }).click()
    await expect(page).toHaveURL(/\/css$/)

    await expect(page.getByTestId('css-heading')).toHaveText(
      'CSS Deferred Hydration',
    )
    await expect(page.getByTestId('css-deferred')).toHaveText('Deferred CSS')
    await expect(page.getByTestId('css-never')).toHaveCount(0)
    await expect(page.getByTestId('css-nested')).toHaveCount(0)

    await expectCssProperty(
      page,
      'css-deferred',
      'background-color',
      'rgb(23, 45, 67)',
    )
  })
})

test.describe('imported Hydrate boundaries', () => {
  test('does not emit filtered shared Hydrate child JS on the initial document', async ({
    request,
  }) => {
    const response = await request.get('/imported')
    const html = await response.text()

    htmlContainsText(html, 'Imported Hydrate')
    htmlContainsText(html, 'Imported Hydrate Child')

    await expect(
      modulePreloadContentsContain(
        request,
        getModulePreloadHrefs(html),
        'imported-hydrate-child',
      ),
    ).resolves.toBe(false)
  })

  test('does not preload Hydrate child chunks before client navigation', async ({
    page,
    request,
  }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-heading')).toHaveText(
      'Deferred Hydration',
    )
    await expectClientRouterReady(page)

    const link = page.getByRole('link', { name: 'imported Hydrate' })
    await page.mouse.move(0, 0)
    await link.hover()
    await link.focus()

    await expect(
      modulePreloadContentsContain(
        request,
        await documentModulePreloadHrefs(page),
        'imported-hydrate-child',
      ),
    ).resolves.toBe(false)
    await expect(
      resourceContentsContain(page, request, 'imported-hydrate-child', (url) =>
        isClientJavaScriptResource(url),
      ),
    ).resolves.toBe(false)

    await page.getByRole('link', { name: 'imported Hydrate' }).click()
    await expect(page).toHaveURL(/\/imported$/)
    await expect(page.getByTestId('imported-hydrate-fallback')).toHaveCount(0)
    await expect(page.getByTestId('imported-hydrate-child')).toContainText(
      'Imported Hydrate Child',
    )
    await page.getByTestId('imported-hydrate-child').click()
    await expect(page.getByTestId('imported-hydrate-count')).toHaveText('1')
  })
})
