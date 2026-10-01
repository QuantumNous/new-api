import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Nested Tests - RSCs composed inside each other via client', () => {
  test('Nested RSCs render correctly on initial load', async ({ page }) => {
    await page.goto('/rsc-nested')
    await page.waitForURL('/rsc-nested')

    // Verify page title
    await expect(page.getByTestId('rsc-nested-title')).toHaveText(
      'E-commerce Product Page - Nested RSCs',
    )

    // Verify outer RSC (Product Card) is rendered
    await expect(page.getByTestId('rsc-product-card')).toBeVisible()
    await expect(page.getByTestId('rsc-product-name')).toContainText(
      'Wireless Noise-Canceling Headphones',
    )
    await expect(page.getByTestId('rsc-product-price')).toContainText('$299.99')
    const productTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    expect(productTimestamp).toBeTruthy()

    // Verify client wrapper (Reviews Section) is rendered
    await expect(page.getByTestId('reviews-section')).toBeVisible()

    // Verify inner RSC (Reviews) is rendered inside
    await expect(page.getByTestId('rsc-product-reviews')).toBeVisible()
    await expect(page.getByTestId('rsc-reviews-title')).toContainText(
      'Customer Reviews',
    )
    const reviewsTimestamp = await page
      .getByTestId('rsc-reviews-timestamp')
      .textContent()
    expect(reviewsTimestamp).toBeTruthy()

    // Verify individual reviews are rendered
    await expect(page.getByTestId('review-rev_1')).toBeVisible()
    await expect(page.getByTestId('review-rev_2')).toBeVisible()
    await expect(page.getByTestId('review-rev_3')).toBeVisible()
  })

  test('Toggling reviews section does not reload either RSC', async ({
    page,
  }) => {
    await page.goto('/rsc-nested')
    await page.waitForURL('/rsc-nested')
    await waitForHydration(page)

    // Get initial timestamps for both RSCs
    const initialProductTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    const initialReviewsTimestamp = await page
      .getByTestId('rsc-reviews-timestamp')
      .textContent()

    // Verify reviews are initially visible
    await expect(page.getByTestId('reviews-content')).toBeVisible()

    // Collapse reviews
    await page.getByTestId('toggle-reviews-btn').click()
    await expect(page.getByTestId('reviews-content')).not.toBeVisible()

    // Expand reviews again
    await page.getByTestId('toggle-reviews-btn').click()
    await expect(page.getByTestId('reviews-content')).toBeVisible()

    // Verify both RSC timestamps are unchanged (neither was reloaded)
    const newProductTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    const newReviewsTimestamp = await page
      .getByTestId('rsc-reviews-timestamp')
      .textContent()

    expect(newProductTimestamp).toBe(initialProductTimestamp)
    expect(newReviewsTimestamp).toBe(initialReviewsTimestamp)
  })

  test('Client actions in inner RSC render prop work correctly', async ({
    page,
  }) => {
    await page.goto('/rsc-nested')
    await page.waitForURL('/rsc-nested')
    await waitForHydration(page)

    // Get initial timestamps
    const initialProductTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    const initialReviewsTimestamp = await page
      .getByTestId('rsc-reviews-timestamp')
      .textContent()

    // Initially no reviews marked helpful
    await expect(page.getByTestId('reviews-section')).toContainText(
      'Marked 0 as helpful',
    )

    // Click helpful on first review
    await page.getByTestId('helpful-btn-rev_1').click()
    await expect(page.getByTestId('helpful-btn-rev_1')).toContainText(
      'Marked Helpful',
    )
    await expect(page.getByTestId('reviews-section')).toContainText(
      'Marked 1 as helpful',
    )

    // Click helpful on second review
    await page.getByTestId('helpful-btn-rev_2').click()
    await expect(page.getByTestId('helpful-btn-rev_2')).toContainText(
      'Marked Helpful',
    )
    await expect(page.getByTestId('reviews-section')).toContainText(
      'Marked 2 as helpful',
    )

    // Toggle first review off
    await page.getByTestId('helpful-btn-rev_1').click()
    await expect(page.getByTestId('helpful-btn-rev_1')).toContainText(
      'Helpful?',
    )
    await expect(page.getByTestId('reviews-section')).toContainText(
      'Marked 1 as helpful',
    )

    // Verify RSC timestamps are still unchanged (client actions don't reload RSCs)
    const newProductTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    const newReviewsTimestamp = await page
      .getByTestId('rsc-reviews-timestamp')
      .textContent()

    expect(newProductTimestamp).toBe(initialProductTimestamp)
    expect(newReviewsTimestamp).toBe(initialReviewsTimestamp)
  })

  test('Nested RSCs render correctly after client-side navigation', async ({
    page,
  }) => {
    // Start at home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to nested RSC page via nav bar
    await page.getByTestId('nav-nested').click()
    await page.waitForURL('/rsc-nested')

    // Verify both RSCs are rendered
    await expect(page.getByTestId('rsc-product-card')).toBeVisible()
    await expect(page.getByTestId('rsc-product-reviews')).toBeVisible()

    // Verify the nesting structure: Product Card contains Reviews Section contains Reviews
    const productCard = page.getByTestId('rsc-product-card')
    await expect(productCard.getByTestId('reviews-section')).toBeVisible()
    await expect(productCard.getByTestId('rsc-product-reviews')).toBeVisible()
  })

  test('Both RSCs have independent timestamps from parallel loading', async ({
    page,
  }) => {
    await page.goto('/rsc-nested')
    await page.waitForURL('/rsc-nested')

    // Get both timestamps
    const productTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    const reviewsTimestamp = await page
      .getByTestId('rsc-reviews-timestamp')
      .textContent()

    // Both should be valid timestamps (truthy strings)
    expect(productTimestamp).toBeTruthy()
    expect(reviewsTimestamp).toBeTruthy()

    // Both timestamps should be present and formatted as time strings
    // They might be the same or slightly different depending on parallel load timing
    expect(productTimestamp!.length).toBeGreaterThan(0)
    expect(reviewsTimestamp!.length).toBeGreaterThan(0)
  })

  test('Combined toggle and client actions preserve RSC state', async ({
    page,
  }) => {
    await page.goto('/rsc-nested')
    await page.waitForURL('/rsc-nested')
    await waitForHydration(page)

    // Get initial timestamps
    const initialProductTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    const initialReviewsTimestamp = await page
      .getByTestId('rsc-reviews-timestamp')
      .textContent()

    // Mark a review as helpful
    await page.getByTestId('helpful-btn-rev_3').click()
    await expect(page.getByTestId('helpful-btn-rev_3')).toContainText(
      'Marked Helpful',
    )

    // Collapse reviews
    await page.getByTestId('toggle-reviews-btn').click()
    await expect(page.getByTestId('reviews-content')).not.toBeVisible()

    // Expand reviews
    await page.getByTestId('toggle-reviews-btn').click()
    await expect(page.getByTestId('reviews-content')).toBeVisible()

    // The helpful state should be preserved
    await expect(page.getByTestId('helpful-btn-rev_3')).toContainText(
      'Marked Helpful',
    )

    // And both RSC timestamps should still be unchanged
    const newProductTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    const newReviewsTimestamp = await page
      .getByTestId('rsc-reviews-timestamp')
      .textContent()

    expect(newProductTimestamp).toBe(initialProductTimestamp)
    expect(newReviewsTimestamp).toBe(initialReviewsTimestamp)
  })
})
