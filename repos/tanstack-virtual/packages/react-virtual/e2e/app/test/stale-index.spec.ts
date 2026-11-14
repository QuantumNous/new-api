import { expect, test } from '@playwright/test'

test('does not call getItemKey with stale index after removing items', async ({
  page,
}) => {
  await page.goto('/stale-index/')

  // Verify initial state
  await expect(page.locator('[data-testid="item-count"]')).toHaveText(
    'Count: 20',
  )

  // Scroll to the bottom so the last items are rendered and observed by ResizeObserver
  const container = page.locator('[data-testid="scroll-container"]')
  await container.evaluate((el) => (el.scrollTop = el.scrollHeight))
  await page.waitForTimeout(100)

  // Remove 5 items from the end — the RO may still fire for the now-disconnected nodes
  await page.click('[data-testid="remove-items"]')
  await expect(page.locator('[data-testid="item-count"]')).toHaveText(
    'Count: 15',
  )

  // Wait for any pending ResizeObserver callbacks
  await page.waitForTimeout(200)

  // No error should have been thrown
  await expect(page.locator('[data-testid="error"]')).not.toBeVisible()

  // Remove 5 more to stress it
  await page.click('[data-testid="remove-items"]')
  await expect(page.locator('[data-testid="item-count"]')).toHaveText(
    'Count: 10',
  )
  await page.waitForTimeout(200)

  await expect(page.locator('[data-testid="error"]')).not.toBeVisible()
})
