import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.describe('RSC Invalidation Tests - Search with pagination and refetch', () => {
  test('Page loads with default search params and renders UI', async ({
    page,
  }) => {
    await page.goto('/rsc-invalidation')
    await page.waitForURL(/\/rsc-invalidation/)

    // Verify page title
    await expect(page.getByTestId('rsc-invalidation-title')).toHaveText(
      'Product Search - RSC Invalidation',
    )

    // Verify search controls are visible
    await expect(page.getByTestId('search-controls')).toBeVisible()
    await expect(page.getByTestId('search-input')).toBeVisible()
    await expect(page.getByTestId('search-btn')).toBeVisible()

    // Verify pagination controls
    await expect(page.getByTestId('prev-page')).toBeVisible()
    await expect(page.getByTestId('current-page')).toContainText('Page 1')
    await expect(page.getByTestId('next-page')).toBeVisible()

    // Verify current params display
    await expect(page.getByTestId('current-params')).toContainText('q=""')

    // Verify RSC search results are rendered (use first to handle possible duplicates)
    await expect(page.getByTestId('rsc-search-results').first()).toBeVisible()
  })

  test('Page loads with query param in URL', async ({ page }) => {
    await page.goto('/rsc-invalidation?q=Electronics&page=1')
    await page.waitForURL(/q=Electronics/)

    // Verify params are reflected in UI
    await expect(page.getByTestId('current-params')).toContainText(
      'q="Electronics"',
    )
    await expect(page.getByTestId('current-page')).toContainText('Page 1')

    // Verify search results show electronics query
    await expect(page.getByTestId('rsc-search-results').first()).toBeVisible()
  })

  test('Page loads with page param in URL', async ({ page }) => {
    await page.goto('/rsc-invalidation?page=2')
    await page.waitForURL(/page=2/)

    // Verify page number is reflected
    await expect(page.getByTestId('current-page')).toContainText('Page 2')

    // Verify prev button is now enabled
    await expect(page.getByTestId('prev-page')).toBeEnabled()
  })

  test('Previous page button is disabled on page 1', async ({ page }) => {
    await page.goto('/rsc-invalidation?page=1')
    await page.waitForURL(/\/rsc-invalidation/)

    // Verify previous button is disabled
    await expect(page.getByTestId('prev-page')).toBeDisabled()
  })

  test('Search input is editable', async ({ page }) => {
    await page.goto('/rsc-invalidation')
    await page.waitForURL(/\/rsc-invalidation/)

    // Type in search input
    await page.getByTestId('search-input').fill('Test Query')

    // Verify the input value changed
    await expect(page.getByTestId('search-input')).toHaveValue('Test Query')
  })

  test('Combined search and page params work correctly', async ({ page }) => {
    await page.goto('/rsc-invalidation?q=Accessories&page=2')
    await page.waitForURL(/q=Accessories.*page=2/)

    // Verify both params are reflected
    await expect(page.getByTestId('current-params')).toContainText(
      'q="Accessories"',
    )
    await expect(page.getByTestId('current-page')).toContainText('Page 2')

    // Verify RSC content is rendered
    await expect(page.getByTestId('rsc-search-results').first()).toBeVisible()
  })

  test('RSC search results show instance ID', async ({ page }) => {
    await page.goto('/rsc-invalidation')
    await page.waitForURL(/\/rsc-invalidation/)

    // Verify RSC instance is visible
    await expect(page.getByTestId('rsc-search-instance').first()).toBeVisible()

    // Instance ID should be a 6 character string
    const instanceId = await page
      .getByTestId('rsc-search-instance')
      .first()
      .textContent()
    expect(instanceId).toMatch(/Instance: [a-z0-9]+/)
  })
})
