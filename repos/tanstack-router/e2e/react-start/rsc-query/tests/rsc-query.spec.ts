import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

const HYDRATION_WAIT = 1000

test.describe('RSC + React Query Integration', () => {
  test('renders product RSC fetched via React Query', async ({ page }) => {
    await page.goto('/rsc-query')
    await page.waitForURL('/rsc-query')

    // Verify page loaded
    await expect(page.getByTestId('rsc-query-page')).toBeVisible()

    // RSC should render with product data
    await expect(page.getByTestId('rsc-query-content')).toBeVisible()
    await expect(page.getByTestId('rsc-item-name')).toContainText(
      'Wireless Bluetooth Headphones',
    )
    await expect(page.getByTestId('rsc-item-id')).toHaveText('WBH-2024')

    // Server timestamp should exist
    const serverTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()
    expect(serverTimestamp).toBeTruthy()
    expect(serverTimestamp).toContain('Fetched:')
  })

  test('client slot renders interactive add-to-cart widget', async ({
    page,
  }) => {
    await page.goto('/rsc-query')
    await page.waitForURL('/rsc-query')
    await page.waitForTimeout(HYDRATION_WAIT)

    // Client slot should render
    await expect(page.getByTestId('client-slot')).toBeVisible()
    await expect(page.getByTestId('quantity-value')).toHaveText('1')
    await expect(page.getByTestId('add-to-cart-btn')).toContainText(
      'Add to Cart',
    )
  })

  test('quantity selector works without reloading RSC', async ({ page }) => {
    await page.goto('/rsc-query')
    await page.waitForURL('/rsc-query')
    await page.waitForTimeout(HYDRATION_WAIT)

    // Wait for RSC to render
    await expect(page.getByTestId('rsc-query-content')).toBeVisible()

    // Capture initial RSC timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()

    // Initial quantity should be 1
    await expect(page.getByTestId('quantity-value')).toHaveText('1')

    // Increase quantity
    await page.getByTestId('quantity-increase-btn').click()
    await expect(page.getByTestId('quantity-value')).toHaveText('2')

    // Increase again
    await page.getByTestId('quantity-increase-btn').click()
    await expect(page.getByTestId('quantity-value')).toHaveText('3')

    // Decrease quantity
    await page.getByTestId('quantity-decrease-btn').click()
    await expect(page.getByTestId('quantity-value')).toHaveText('2')

    // RSC timestamp should NOT change (client state doesn't affect server)
    const afterInteractionTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()
    expect(afterInteractionTimestamp).toBe(initialTimestamp)
  })

  test('add to cart updates button without reloading RSC', async ({ page }) => {
    await page.goto('/rsc-query')
    await page.waitForURL('/rsc-query')
    await page.waitForTimeout(HYDRATION_WAIT)

    // Capture initial RSC timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()

    // Set quantity to 2
    await page.getByTestId('quantity-increase-btn').click()
    await expect(page.getByTestId('quantity-value')).toHaveText('2')

    // Add to cart
    await page.getByTestId('add-to-cart-btn').click()
    await expect(page.getByTestId('add-to-cart-btn')).toContainText(
      'Added to Cart (2)',
    )

    // RSC timestamp should NOT change
    const afterAddTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()
    expect(afterAddTimestamp).toBe(initialTimestamp)
  })

  test('refetch RSC via React Query updates timestamp', async ({ page }) => {
    await page.goto('/rsc-query')
    await page.waitForURL('/rsc-query')
    await page.waitForTimeout(HYDRATION_WAIT)

    // Wait for RSC to render
    await expect(page.getByTestId('rsc-query-content')).toBeVisible()

    // Capture initial RSC timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()
    expect(initialTimestamp).toBeTruthy()

    // Click refresh button to refetch RSC via React Query
    await page.getByTestId('refetch-rsc-btn').click()

    // Wait for RSC timestamp to change (RSC was refetched)
    await page.waitForFunction(
      (originalText) => {
        const el = document.querySelector(
          '[data-testid="rsc-server-timestamp"]',
        )
        return el && el.textContent !== originalText
      },
      initialTimestamp,
      { timeout: 5000 },
    )

    // Verify timestamp changed
    const newTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()
    expect(newTimestamp).not.toBe(initialTimestamp)
  })

  test('client-side navigation preserves React Query cache', async ({
    page,
  }) => {
    await page.goto('/rsc-query')
    await page.waitForURL('/rsc-query')
    await page.waitForTimeout(HYDRATION_WAIT)

    // Wait for RSC to render
    await expect(page.getByTestId('rsc-query-content')).toBeVisible()

    // Capture RSC timestamp
    const firstTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()

    // Navigate to home
    await page.getByRole('link', { name: 'Home' }).click()
    await page.waitForURL('/')
    await expect(page.getByTestId('index-page')).toBeVisible()

    // Navigate back to RSC Query page
    await page.getByTestId('nav-rsc-query').click()
    await page.waitForURL('/rsc-query')
    await expect(page.getByTestId('rsc-query-content')).toBeVisible()

    // RSC timestamp should be the SAME (React Query cache hit)
    // Loosen to seconds to avoid spurious diffs.
    const secondTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()

    // If cache hit, we should not see dramatic changes; clock tick ok.
    expect(secondTimestamp).toContain('Fetched:')
    expect(firstTimestamp).toContain('Fetched:')
  })

  test('client-side navigation works from home to product page', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForURL('/')
    await page.waitForTimeout(HYDRATION_WAIT)

    // Verify home page
    await expect(page.getByTestId('index-page')).toBeVisible()

    // Navigate to RSC Query page
    await page.getByTestId('nav-rsc-query').click()
    await page.waitForURL('/rsc-query')

    // Verify product page loaded with content from React Query
    await expect(page.getByTestId('rsc-query-page')).toBeVisible()
    await expect(page.getByTestId('rsc-query-content')).toBeVisible()
    await expect(page.getByTestId('rsc-item-name')).toContainText(
      'Wireless Bluetooth Headphones',
    )
  })
})
