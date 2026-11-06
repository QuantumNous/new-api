import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Component Slot Tests - Passing components as props', () => {
  test('Renders server product card with client component slots', async ({
    page,
  }) => {
    await page.goto('/rsc-component-slot')
    await page.waitForURL('/rsc-component-slot')
    await waitForHydration(page)

    // Verify server-rendered product card
    await expect(page.getByTestId('rsc-product-card')).toBeVisible()
    await expect(page.getByTestId('product-name')).toContainText(
      'Premium Wireless Headphones',
    )
    await expect(page.getByTestId('product-price')).toContainText('$299.99')

    // Verify client components are rendered in slots
    await expect(page.getByTestId('rating-badge')).toBeVisible()
    await expect(page.getByTestId('add-to-cart-btn')).toBeVisible()
    await expect(page.getByTestId('product-id-display')).toContainText(
      'PRD-12345',
    )
  })

  test('Changing quantity does not reload RSC', async ({ page }) => {
    await page.goto('/rsc-component-slot')
    await page.waitForURL('/rsc-component-slot')
    await waitForHydration(page)

    // Get initial RSC timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()

    // Verify initial quantity
    await expect(page.getByTestId('quantity-display')).toContainText('1')
    await expect(page.getByTestId('add-to-cart-btn')).toContainText(
      'Add to Cart - $299.99',
    )

    // Increase quantity
    await page.getByTestId('increase-qty-btn').click()
    await expect(page.getByTestId('quantity-display')).toContainText('2')
    await expect(page.getByTestId('add-to-cart-btn')).toContainText(
      'Add to Cart - $599.98',
    )

    // Increase again
    await page.getByTestId('increase-qty-btn').click()
    await expect(page.getByTestId('quantity-display')).toContainText('3')
    await expect(page.getByTestId('add-to-cart-btn')).toContainText(
      'Add to Cart - $899.97',
    )

    // Verify RSC timestamp is unchanged
    const newTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    expect(newTimestamp).toBe(initialTimestamp)
  })

  test('Toggling badge details does not reload RSC', async ({ page }) => {
    await page.goto('/rsc-component-slot')
    await page.waitForURL('/rsc-component-slot')
    await waitForHydration(page)

    // Get initial RSC timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()

    // Verify badge without details initially
    await expect(page.getByTestId('rating-badge')).toBeVisible()
    await expect(page.getByTestId('rating-details')).not.toBeVisible()

    // Toggle to show details
    await page.getByTestId('toggle-badge-details-btn').click()
    await expect(page.getByTestId('rating-details')).toBeVisible()
    await expect(page.getByTestId('rating-details')).toContainText('Excellent')

    // Toggle to hide details
    await page.getByTestId('toggle-badge-details-btn').click()
    await expect(page.getByTestId('rating-details')).not.toBeVisible()

    // Verify RSC timestamp is unchanged
    const newTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    expect(newTimestamp).toBe(initialTimestamp)
  })

  test('Add to cart interaction does not reload RSC', async ({ page }) => {
    await page.goto('/rsc-component-slot')
    await page.waitForURL('/rsc-component-slot')
    await waitForHydration(page)

    // Get initial RSC timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()

    // Click add to cart
    await page.getByTestId('add-to-cart-btn').click()

    // Verify button state changes
    await expect(page.getByTestId('add-to-cart-btn')).toContainText('Adding...')
    await expect(page.getByTestId('add-to-cart-btn')).toContainText(
      '✓ Added!',
      { timeout: 2000 },
    )

    // Wait for button to reset
    await expect(page.getByTestId('add-to-cart-btn')).toContainText(
      'Add to Cart',
      { timeout: 3000 },
    )

    // Verify RSC timestamp is unchanged
    const newTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    expect(newTimestamp).toBe(initialTimestamp)
  })

  test('Multiple component slot changes do not reload RSC', async ({
    page,
  }) => {
    await page.goto('/rsc-component-slot')
    await page.waitForURL('/rsc-component-slot')
    await waitForHydration(page)

    // Get initial RSC timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()

    // Make multiple changes
    await page.getByTestId('increase-qty-btn').click()
    await page.getByTestId('increase-qty-btn').click()
    await page.getByTestId('toggle-badge-details-btn').click()
    await page.getByTestId('decrease-qty-btn').click()

    // Verify all changes took effect
    await expect(page.getByTestId('quantity-display')).toContainText('2')
    await expect(page.getByTestId('rating-details')).toBeVisible()
    await expect(page.getByTestId('add-to-cart-btn')).toContainText(
      'Add to Cart - $599.98',
    )

    // Verify RSC timestamp is unchanged
    const newTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    expect(newTimestamp).toBe(initialTimestamp)
  })

  test('Reset quantity works without reloading RSC', async ({ page }) => {
    await page.goto('/rsc-component-slot')
    await page.waitForURL('/rsc-component-slot')
    await waitForHydration(page)

    // Get initial RSC timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()

    // Increase quantity
    await page.getByTestId('increase-qty-btn').click()
    await page.getByTestId('increase-qty-btn').click()
    await page.getByTestId('increase-qty-btn').click()
    await expect(page.getByTestId('quantity-display')).toContainText('4')

    // Reset quantity
    await page.getByTestId('reset-quantity-btn').click()
    await expect(page.getByTestId('quantity-display')).toContainText('1')
    await expect(page.getByTestId('add-to-cart-btn')).toContainText(
      'Add to Cart - $299.99',
    )

    // Verify RSC timestamp is unchanged
    const newTimestamp = await page
      .getByTestId('rsc-product-timestamp')
      .textContent()
    expect(newTimestamp).toBe(initialTimestamp)
  })

  test('Server provides data to client components via props', async ({
    page,
  }) => {
    await page.goto('/rsc-component-slot')
    await page.waitForURL('/rsc-component-slot')
    await waitForHydration(page)

    // Verify server-provided data is passed to client components
    // Product ID comes from server and is displayed in client component
    await expect(page.getByTestId('product-id-display')).toContainText(
      'PRD-12345',
    )

    // Price comes from server and is used in cart calculation
    await expect(page.getByTestId('add-to-cart-btn')).toContainText('$299.99')

    // Rating comes from server and is displayed in badge
    await expect(page.getByTestId('rating-badge')).toContainText('4.8')
  })
})
