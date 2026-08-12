import { expect, test } from '@playwright/test'

test('smooth scrolls to index 1000', async ({ page }) => {
  await page.goto('/smooth-scroll/')
  await page.click('#scroll-to-1000')

  // Smooth scroll animation is 500ms + reconciliation time
  await page.waitForTimeout(2000)

  await expect(page.locator('[data-testid="item-1000"]')).toBeVisible()

  const delta = await page.evaluate(() => {
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
  })
  expect(delta).toBeLessThan(1.01)
})

test('smooth scrolls to index 100', async ({ page }) => {
  await page.goto('/smooth-scroll/')
  await page.click('#scroll-to-100')

  await page.waitForTimeout(2000)

  await expect(page.locator('[data-testid="item-100"]')).toBeVisible()
})

test('smooth scrolls to index 0 after scrolling away', async ({ page }) => {
  await page.goto('/smooth-scroll/')

  // First scroll down
  await page.click('#scroll-to-500')
  await page.waitForTimeout(2000)
  await expect(page.locator('[data-testid="item-500"]')).toBeVisible()

  // Then smooth scroll back to top
  await page.click('#scroll-to-0')
  await page.waitForTimeout(2000)

  await expect(page.locator('[data-testid="item-0"]')).toBeVisible()

  const scrollTop = await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    return container?.scrollTop ?? -1
  })
  expect(scrollTop).toBeLessThan(1.01)
})

test('smooth scrolls to index 500 with start alignment', async ({ page }) => {
  await page.goto('/smooth-scroll/')
  await page.click('#scroll-to-500-start')

  await page.waitForTimeout(2000)

  await expect(page.locator('[data-testid="item-500"]')).toBeVisible()

  const delta = await page.evaluate(
    ([idx, align]) => {
      const item = document.querySelector(`[data-testid="item-${idx}"]`)
      const container = document.querySelector('#scroll-container')
      if (!item || !container) throw new Error('Elements not found')
      const itemRect = item.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      if (align === 'start') {
        return Math.abs(itemRect.top - containerRect.top)
      }
      return 0
    },
    [500, 'start'] as const,
  )
  expect(delta).toBeLessThan(1.01)
})

test('smooth scrolls to index 500 with center alignment', async ({ page }) => {
  await page.goto('/smooth-scroll/')
  await page.click('#scroll-to-500-center')

  await page.waitForTimeout(2000)

  await expect(page.locator('[data-testid="item-500"]')).toBeVisible()

  const delta = await page.evaluate(
    ([idx]) => {
      const item = document.querySelector(`[data-testid="item-${idx}"]`)
      const container = document.querySelector('#scroll-container')
      if (!item || !container) throw new Error('Elements not found')
      const itemRect = item.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      const containerCenter = containerRect.top + containerRect.height / 2
      const itemCenter = itemRect.top + itemRect.height / 2
      return Math.abs(itemCenter - containerCenter)
    },
    [500] as const,
  )
  // Center alignment has slightly more tolerance due to rounding
  expect(delta).toBeLessThan(50)
})

test('smooth scrolls sequentially to multiple targets', async ({ page }) => {
  await page.goto('/smooth-scroll/')

  // Scroll to 100 first
  await page.click('#scroll-to-100')
  await page.waitForTimeout(2000)
  await expect(page.locator('[data-testid="item-100"]')).toBeVisible()

  // Then scroll to 500
  await page.click('#scroll-to-500')
  await page.waitForTimeout(2000)
  await expect(page.locator('[data-testid="item-500"]')).toBeVisible()

  // Then scroll to 1000
  await page.click('#scroll-to-1000')
  await page.waitForTimeout(2000)
  await expect(page.locator('[data-testid="item-1000"]')).toBeVisible()
})

test('interrupting smooth scroll with another smooth scroll', async ({
  page,
}) => {
  await page.goto('/smooth-scroll/')

  // Start scrolling to 1000
  await page.click('#scroll-to-1000')
  // Interrupt mid-animation (before the 500ms animation completes)
  await page.waitForTimeout(200)
  await page.click('#scroll-to-100')

  // Wait for the second scroll to complete
  await page.waitForTimeout(2000)

  // Should have ended at 100, not 1000
  await expect(page.locator('[data-testid="item-100"]')).toBeVisible()
})
