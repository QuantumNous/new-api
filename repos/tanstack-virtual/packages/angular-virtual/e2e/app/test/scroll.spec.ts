import { expect, test } from '@playwright/test'

const check = () => {
  const item = document.querySelector('[data-testid="item-1000"]')
  const container = document.querySelector('#scroll-container')

  if (!item || !container) throw new Error('Elements not found')

  const itemRect = item.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  const scrollTop = container.scrollTop

  const top = itemRect.top + scrollTop - containerRect.top
  const bottom = top + itemRect.height

  const containerBottom = scrollTop + container.clientHeight

  return Math.abs(bottom - containerBottom)
}

test('scrolls to index 1000', async ({ page }) => {
  await page.goto('/scroll/')
  await page.click('#scroll-to-1000')

  // Wait for scroll effect (including retries)
  await page.waitForTimeout(1000)

  await expect(page.locator('[data-testid="item-1000"]')).toBeVisible()

  const delta = await page.evaluate(check)
  // Angular layout/scroll alignment needs a slightly higher tolerance than React.
  expect(delta).toBeLessThan(4.5)
})

test('scrolls to last item', async ({ page }) => {
  await page.goto('/scroll/')
  await page.click('#scroll-to-last')

  await page.waitForTimeout(1000)

  // Last item (index 1001) should be visible
  await expect(page.locator('[data-testid="item-1001"]')).toBeVisible()

  // Container should be scrolled to the very bottom
  const atBottom = await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    return Math.abs(
      container.scrollTop + container.clientHeight - container.scrollHeight,
    )
  })
  expect(atBottom).toBeLessThan(1.01)
})

test('renders correctly with initialOffset and user scroll up', async ({
  page,
}) => {
  // Start at offset 5000 (no programmatic scrollToIndex)
  await page.goto('/scroll/?initialOffset=5000')
  await page.waitForTimeout(500)

  // Items around offset 5000 should be visible
  const visibleIndex = await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    const items = container.querySelectorAll('[data-index]')
    const indices = Array.from(items).map((el) =>
      Number(el.getAttribute('data-index')),
    )
    return Math.min(...indices)
  })
  expect(visibleIndex).toBeGreaterThan(0)

  // Scroll up by 2000px (user scroll, not programmatic)
  await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    container.scrollTop -= 2000
  })
  await page.waitForTimeout(500)

  // After scroll up, items should be properly measured and positioned
  // (no gaps, no overlaps) — verify consecutive items are contiguous
  const layout = await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    const items = Array.from(container.querySelectorAll('[data-index]'))
      .map((el) => {
        const rect = el.getBoundingClientRect()
        return {
          index: Number(el.getAttribute('data-index')),
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
        }
      })
      .sort((a, b) => a.index - b.index)

    // Check that each item's top matches the previous item's bottom (within tolerance)
    let maxGap = 0
    for (let i = 1; i < items.length; i++) {
      const gap = Math.abs(items[i].top - items[i - 1].bottom)
      maxGap = Math.max(maxGap, gap)
    }

    return { items, maxGap }
  })

  expect(layout.items.length > 0).toBe(true)
  expect(layout.items.length).toBeGreaterThan(3)
  // Items should be contiguous — no gaps between consecutive items
  expect(layout.maxGap).toBeLessThan(2)
})

test('scrolls to index 0', async ({ page }) => {
  await page.goto('/scroll/')

  // First scroll down
  await page.click('#scroll-to-1000')
  await page.waitForTimeout(1000)

  // Then scroll to first item
  await page.click('#scroll-to-0')
  await page.waitForTimeout(1000)

  await expect(page.locator('[data-testid="item-0"]')).toBeVisible()

  const scrollTop = await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    return container?.scrollTop ?? -1
  })
  expect(scrollTop).toBeLessThan(1.01)
})
