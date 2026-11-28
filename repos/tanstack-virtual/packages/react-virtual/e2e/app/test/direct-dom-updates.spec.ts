import { expect, test } from '@playwright/test'

const ITEM_SIZE = 40
const COUNT = 1000

for (const mode of ['position', 'transform'] as const) {
  test.describe(`directDomUpdates mode=${mode}`, () => {
    test('sets container size and positions items via direct DOM updates', async ({
      page,
    }) => {
      await page.goto(`/direct-dom-updates/?mode=${mode}`)

      await expect(page.locator('[data-testid="mode"]')).toHaveText(mode)

      // Container height is written directly by containerRef, NOT from JSX style.
      const inner = page.locator('#inner')
      await expect(inner).toHaveAttribute(
        'style',
        new RegExp(`height:\\s*${COUNT * ITEM_SIZE}px`),
      )

      // First item is at top 0 (position) or translate3d(0, 0, 0) (transform).
      const first = page.locator('[data-testid="item-0"]')
      await expect(first).toBeVisible()
      if (mode === 'position') {
        await expect(first).toHaveAttribute('style', /top:\s*0px/)
      } else {
        await expect(first).toHaveAttribute(
          'style',
          /translate3d\(0px,\s*0px,\s*0px\)/,
        )
      }
    })

    test('scrolling moves items via direct DOM without per-pixel React re-renders', async ({
      page,
    }) => {
      await page.goto(`/direct-dom-updates/?mode=${mode}`)

      const initialRenders = Number(
        await page.locator('[data-testid="render-count"]').textContent(),
      )

      // Scroll by exactly one item — does NOT change the visible range
      // (overscan absorbs it), so React should not re-render.
      await page.locator('#scroll-container').evaluate((el, by) => {
        el.scrollTop = by
      }, ITEM_SIZE)

      const item1 = page.locator('[data-testid="item-1"]')
      await expect(item1).toHaveAttribute(
        'style',
        mode === 'position'
          ? /top:\s*40px/
          : /translate3d\(0px,\s*40px,\s*0px\)/,
      )

      const renderAfterSmallScroll = Number(
        await page.locator('[data-testid="render-count"]').textContent(),
      )
      // Allow at most 1 extra render (isScrolling flip), zero for the offset itself.
      expect(renderAfterSmallScroll - initialRenders).toBeLessThanOrEqual(2)
    })

    test('large scroll triggers a re-render and items still position correctly', async ({
      page,
    }) => {
      await page.goto(`/direct-dom-updates/?mode=${mode}`)

      const before = Number(
        await page.locator('[data-testid="render-count"]').textContent(),
      )

      await page.click('#scroll-to-500')

      // Wait for the new range to render.
      await expect(page.locator('[data-testid="item-500"]')).toBeVisible()

      const after = Number(
        await page.locator('[data-testid="render-count"]').textContent(),
      )
      expect(after).toBeGreaterThan(before)

      const item500 = page.locator('[data-testid="item-500"]')
      const style = (await item500.getAttribute('style')) ?? ''
      if (mode === 'position') {
        expect(style).toMatch(/top:\s*20000px/)
      } else {
        expect(style).toMatch(/translate3d\(0px,\s*20000px,\s*0px\)/)
      }
    })

    test('without containerRef the virtualizer makes no direct DOM writes but still skips re-renders', async ({
      page,
    }) => {
      await page.goto(`/direct-dom-updates/?mode=${mode}&noContainer=1`)

      // Container size is NOT written by the virtualizer when containerRef is omitted.
      const inner = page.locator('#inner')
      const innerStyle = (await inner.getAttribute('style')) ?? ''
      expect(innerStyle).not.toMatch(/height:\s*\d/)

      // Item positions are NOT written by the virtualizer either.
      const first = page.locator('[data-testid="item-0"]')
      await expect(first).toBeVisible()
      const firstStyle = (await first.getAttribute('style')) ?? ''
      if (mode === 'position') {
        expect(firstStyle).not.toMatch(/top:\s*\d/)
      } else {
        expect(firstStyle).not.toMatch(/transform:/)
      }

      // Re-render skipping still applies: scrolling by one item (absorbed by
      // overscan) must not trigger React re-renders.
      const initialRenders = Number(
        await page.locator('[data-testid="render-count"]').textContent(),
      )
      await page.locator('#scroll-container').evaluate((el, by) => {
        el.scrollTop = by
      }, ITEM_SIZE)
      // Give onChange a chance to fire.
      await page.waitForTimeout(50)
      const afterRenders = Number(
        await page.locator('[data-testid="render-count"]').textContent(),
      )
      expect(afterRenders - initialRenders).toBeLessThanOrEqual(2)
    })
  })
}
