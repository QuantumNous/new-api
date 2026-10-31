import { expect, test } from '@playwright/test'

// Records the data-index and viewport-relative top of a rendered item that
// sits clearly inside the viewport (so it is already measured) with rows above
// it inside the viewport and room to stay visible after a moderate upward
// scroll moves it down. The window is wider than a row (rows are 90px) so it
// always contains at least one candidate; we pick the one nearest the target.
const pickAnchor = () => {
  const container = document.querySelector('#scroll-container')
  if (!container) throw new Error('Container not found')
  const containerTop = container.getBoundingClientRect().top

  const TARGET = 100
  const candidates = Array.from(container.querySelectorAll('[data-index]'))
    .map((el) => ({
      index: Number(el.getAttribute('data-index')),
      top: el.getBoundingClientRect().top - containerTop,
    }))
    // Away from both edges: rows above it, and room to move down ~200px.
    .filter((c) => c.top > 30 && c.top < 170)
    .sort((a, b) => Math.abs(a.top - TARGET) - Math.abs(b.top - TARGET))

  if (candidates.length === 0) throw new Error('No anchor candidate found')
  return candidates[0]
}

const topOfIndex = (index: number) => {
  const container = document.querySelector('#scroll-container')
  if (!container) throw new Error('Container not found')
  const el = container.querySelector(`[data-index="${index}"]`)
  if (!el) return null
  return el.getBoundingClientRect().top - container.getBoundingClientRect().top
}

// Largest gap between consecutive rendered rows. Before measurement, rows are
// positioned from the 50px estimate while their real height is 90px, so they
// overlap (gap ~40px); once measured, positions are contiguous (gap ~0). This
// is a direct, pollable signal that measurement has settled. Returns a large
// finite sentinel (not Infinity — page.evaluate serializes that to null) when
// the DOM isn't ready yet so the poll keeps waiting.
const NOT_READY = 1e9
const maxRowGap = () => {
  const container = document.querySelector('#scroll-container')
  if (!container) return NOT_READY
  const containerTop = container.getBoundingClientRect().top
  const rows = Array.from(container.querySelectorAll('[data-index]'))
    .map((el) => {
      const rect = el.getBoundingClientRect()
      return {
        top: rect.top - containerTop,
        bottom: rect.bottom - containerTop,
      }
    })
    .sort((a, b) => a.top - b.top)
  if (rows.length < 2) return NOT_READY
  let gap = 0
  for (let i = 1; i < rows.length; i++) {
    gap = Math.max(gap, Math.abs(rows[i].top - rows[i - 1].bottom))
  }
  return gap
}

// Regression test for the "items jump while scrolling up" bug.
//
// When scrolling backward into never-measured items, their estimate→actual
// size delta lives above the viewport, so scrollTop MUST be compensated or the
// anchored content visibly jumps. The fix adjusts on first measurement even
// during backward scroll (it only skips compensation for RE-measurements while
// scrolling up). This test anchors on a visible item and asserts it moves down
// by exactly the scroll delta — no extra jump from uncompensated measurement.
test('anchored item stays stable when scrolling up into unmeasured items', async ({
  page,
}) => {
  await page.goto('/scroll-anchor/?initialOffset=10000')

  // Wait for the initial measurement to settle (rows become contiguous).
  await expect.poll(() => page.evaluate(maxRowGap)).toBeLessThan(1)

  const anchor = await page.evaluate(pickAnchor)

  const SCROLL_UP = 200
  await page.evaluate((delta) => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    container.scrollTop -= delta
  }, SCROLL_UP)

  // Poll until the anchor settles at its compensated position: it should have
  // moved down by exactly the scroll delta. With the fix this converges; any
  // extra shift is the uncompensated estimate→actual delta of the items
  // measured above it (~40px per item) — the regression — and times out here.
  await expect
    .poll(async () => {
      const top = await page.evaluate(topOfIndex, anchor.index)
      return top === null ? Infinity : Math.abs(top - (anchor.top + SCROLL_UP))
    })
    .toBeLessThan(8)
})
