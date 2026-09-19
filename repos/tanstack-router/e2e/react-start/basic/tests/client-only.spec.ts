import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

/**
 * These tests verify the <ClientOnly> compiler optimization.
 *
 * The WindowSize component accesses `window` at module scope, which would
 * throw if the module is ever imported on the server. The compiler optimization
 * strips <ClientOnly> children from the server bundle, allowing DCE to remove
 * the WindowSize import entirely. This prevents the server from crashing.
 *
 * If these tests pass in SSR mode, it proves the compiler is correctly
 * removing client-only code from the server bundle.
 */

test('ClientOnly renders fallback on server, then client content after hydration', async ({
  page,
}) => {
  // Navigate directly to the client-only route
  // If the compiler optimization isn't working, this would crash the server
  // because WindowSize.tsx accesses `window` at module scope
  await page.goto('/client-only')
  await page.waitForURL('/client-only')

  // The heading should be visible
  await expect(page.getByTestId('client-only-heading')).toContainText(
    'Client Only Demo',
  )

  // After hydration, the WindowSize component should render with actual values
  // Wait for the client-side component to render
  await expect(page.getByTestId('window-size')).toBeVisible()
  await expect(page.getByTestId('window-width')).toContainText('Window width:')
  await expect(page.getByTestId('window-height')).toContainText(
    'Window height:',
  )
})

test('ClientOnly works with client-side navigation', async ({ page }) => {
  // Start from home
  await page.goto('/')
  await page.waitForURL('/')

  // Navigate to client-only route via client-side navigation
  await page.getByRole('link', { name: 'Client Only' }).click()
  await page.waitForURL('/client-only')

  // The WindowSize component should render
  await expect(page.getByTestId('window-size')).toBeVisible()
  await expect(page.getByTestId('window-width')).toContainText('Window width:')
})

test('ClientOnly component displays actual window dimensions', async ({
  page,
}) => {
  // Set a specific viewport size
  await page.setViewportSize({ width: 800, height: 600 })

  await page.goto('/client-only')
  await page.waitForURL('/client-only')

  // Wait for client-side hydration
  await expect(page.getByTestId('window-size')).toBeVisible()

  // Check that the displayed dimensions match the viewport
  await expect(page.getByTestId('window-width')).toContainText(
    'Window width: 800',
  )
  await expect(page.getByTestId('window-height')).toContainText(
    'Window height: 600',
  )
})
