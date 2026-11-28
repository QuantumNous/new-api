import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

/**
 * These tests verify the compiler can handle type-only module re-exports.
 *
 * The scenario:
 * 1. ~/shared-lib/index.ts re-exports from ./middleware and ./types
 * 2. ~/shared-lib/types/index.ts re-exports from ./actions.ts
 * 3. ~/shared-lib/types/actions.ts contains ONLY type exports (no runtime code)
 *
 * After TypeScript compilation, actions.ts becomes an empty JavaScript module.
 * The compiler must handle this gracefully when tracing exports through
 * barrel files. Without the fix, the build would fail with:
 * "could not load module .../types/actions.ts"
 *
 * If these tests pass, it proves the compiler correctly handles empty modules
 * when following re-export chains.
 */

test('page using middleware from barrel with type-only re-exports builds and renders', async ({
  page,
}) => {
  // Navigate to the route that uses middleware from ~/shared-lib
  // If the compiler fix isn't working, this page wouldn't exist because
  // the build would have failed
  await page.goto('/type-only-reexport')
  await page.waitForURL('/type-only-reexport')

  // The heading should be visible
  await expect(page.getByTestId('type-only-heading')).toContainText(
    'Type-Only Re-export Test',
  )

  // The server function should have executed and returned data
  await expect(page.getByTestId('message')).toContainText(
    'Hello from server with type-only module re-exports!',
  )
})
