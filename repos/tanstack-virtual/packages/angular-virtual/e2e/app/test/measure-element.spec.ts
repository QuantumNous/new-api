import { expect, test } from '@playwright/test'

test('positions items correctly after expand → collapse → delete → expand', async ({
  page,
}) => {
  await page.goto('/measure-element/')

  // All 3 items visible at ~36px each
  await expect(page.locator('[data-testid="item-a"]')).toBeVisible()
  await expect(page.locator('[data-testid="item-b"]')).toBeVisible()
  await expect(page.locator('[data-testid="item-c"]')).toBeVisible()

  // Step 1: Expand A → should grow to ~160px
  await page.click('[data-testid="expand-item-a"]')
  await expect(page.locator('[data-testid="content-item-a"]')).toBeVisible()

  // Step 2: Collapse A → back to ~36px
  await page.click('[data-testid="expand-item-a"]')
  await expect(page.locator('[data-testid="content-item-a"]')).not.toBeVisible()

  // Step 3: Delete A
  await page.click('[data-testid="delete-item-a"]')
  await expect(page.locator('[data-testid="item-a"]')).not.toBeVisible()

  // Step 4: Expand B → should grow to ~160px
  await page.click('[data-testid="expand-item-b"]')
  await expect(page.locator('[data-testid="content-item-b"]')).toBeVisible()

  // Wait for ResizeObserver to measure the expanded B
  await page.waitForTimeout(200)

  // C should be positioned after the expanded B, not overlapping it
  const bBox = await page.locator('[data-testid="item-b"]').boundingBox()
  const cBox = await page.locator('[data-testid="item-c"]').boundingBox()

  expect(bBox).not.toBeNull()
  expect(cBox).not.toBeNull()

  // C's top should be at or after B's bottom (with no overlap)
  const bBottom = bBox!.y + bBox!.height
  expect(cBox!.y).toBeGreaterThanOrEqual(bBottom - 1) // 1px tolerance
})
