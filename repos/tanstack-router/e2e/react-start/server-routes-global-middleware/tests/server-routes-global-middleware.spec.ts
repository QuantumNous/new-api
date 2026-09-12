import { expect, test } from '@playwright/test'

/**
 * E2E tests for server routes global middleware deduplication
 * Issue #5239: global request middleware is executed multiple times for single request
 *
 * These tests verify that when the same middleware is registered in BOTH:
 * 1. Global requestMiddleware (in start.ts)
 * 2. Server route middleware (in the route's server.middleware array)
 *
 * ...the middleware only executes ONCE per request, not twice.
 *
 * NOTE: Server route handlers (GET, POST, etc.) only execute on direct navigation (SSR).
 * Client-side navigation does NOT trigger the server route handler.
 */

test.describe('Server Routes Global Middleware Deduplication', () => {
  test.describe('Direct Navigation (SSR)', () => {
    test('loggingMiddleware should execute exactly once when in both global and route middleware', async ({
      page,
    }) => {
      // Navigate directly to the server route
      // This triggers SSR with the full server route handler execution
      await page.goto('/server-route-with-middleware')

      // Wait for the page to fully load
      await expect(
        page.locator('[data-testid="middleware-counts"]'),
      ).toBeVisible()

      // Get the middleware execution count for loggingMiddleware
      const loggingCount = await page
        .locator('[data-testid="logging-middleware-count"]')
        .textContent()

      // loggingMiddleware should execute exactly once
      // It's in global requestMiddleware AND in the route's server.middleware
      // With proper deduplication, it should only run once
      expect(loggingCount).toBe('1')

      // Verify the deduplication status message
      const dedupStatus = await page
        .locator('[data-testid="dedup-status"]')
        .textContent()
      expect(dedupStatus).toContain('SUCCESS')
    })

    test('authMiddleware should execute exactly once (global only)', async ({
      page,
    }) => {
      // Navigate directly to the server route
      await page.goto('/server-route-with-middleware')

      // Wait for the page to fully load
      await expect(
        page.locator('[data-testid="middleware-counts"]'),
      ).toBeVisible()

      // Get the middleware execution count for authMiddleware
      const authCount = await page
        .locator('[data-testid="auth-middleware-count"]')
        .textContent()

      // authMiddleware is only in global requestMiddleware, not in route middleware
      // It should execute exactly once
      expect(authCount).toBe('1')
    })

    test('server context should contain middleware data', async ({ page }) => {
      // Navigate directly to the server route
      await page.goto('/server-route-with-middleware')

      // Wait for the page to fully load
      await expect(page.locator('[data-testid="server-context"]')).toBeVisible()

      // Get the server context
      const serverContextText = await page
        .locator('[data-testid="server-context"]')
        .textContent()

      const serverContext = JSON.parse(serverContextText || '{}')

      // Verify middleware context data is present
      expect(serverContext.loggingMiddlewareExecuted).toBe(true)
      expect(serverContext.authMiddlewareExecuted).toBe(true)
      expect(serverContext.userId).toBe('test-user-123')
    })

    test('middleware counts object should have correct structure', async ({
      page,
    }) => {
      // Navigate directly to the server route
      await page.goto('/server-route-with-middleware')

      // Wait for the page to fully load
      await expect(
        page.locator('[data-testid="middleware-counts"]'),
      ).toBeVisible()

      // Get the full middleware counts object
      const countsText = await page
        .locator('[data-testid="middleware-counts"]')
        .textContent()

      const counts = JSON.parse(countsText || '{}')

      // Both middlewares should have executed exactly once
      expect(counts).toEqual({
        loggingMiddleware: 1,
        authMiddleware: 1,
      })
    })
  })
})
