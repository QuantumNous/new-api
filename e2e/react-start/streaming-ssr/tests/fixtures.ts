import { test as base, expect, type Page } from '@playwright/test'

/**
 * Verifies that React hydration has completed by clicking the global
 * hydration check button and verifying the status changes.
 *
 * This is the canonical way to verify hydration in streaming-ssr tests.
 * The HydrationCheck component is rendered in the root layout (__root.tsx).
 *
 * The function retries clicking until the status changes to 'hydrated',
 * which handles the case where the button is visible from SSR before
 * React has finished hydrating.
 */
async function verifyHydration(
  page: Page,
  options: { timeout?: number } = {},
): Promise<void> {
  const timeout = options.timeout ?? 10000
  const button = page.getByTestId('hydration-check-btn')
  const status = page.getByTestId('hydration-status')

  // Ensure the button is visible
  await expect(button).toBeVisible()

  // Retry clicking until hydration succeeds
  // This handles the case where SSR renders the button before React hydrates
  await expect(async () => {
    // Click the button to trigger hydration verification
    await button.click()

    // Check if the status changed to 'hydrated'
    await expect(status).toHaveText('hydrated', { timeout: 100 })
  }).toPass({ timeout })
}

export interface StreamingSsrOptions {
  /**
   * List of error message patterns to ignore in console output.
   */
  whitelistErrors: Array<RegExp | string>
}

/**
 * Base test fixture for streaming-ssr e2e tests.
 * Provides console error monitoring.
 */
export const test = base.extend<StreamingSsrOptions>({
  whitelistErrors: [[], { option: true }],

  page: async ({ page, whitelistErrors }, use) => {
    const errorMessages: Array<string> = []

    page.on('console', (m) => {
      if (m.type() === 'error') {
        const text = m.text()
        for (const whitelistError of whitelistErrors) {
          if (
            (typeof whitelistError === 'string' &&
              text.includes(whitelistError)) ||
            (whitelistError instanceof RegExp && whitelistError.test(text))
          ) {
            return
          }
        }
        errorMessages.push(text)
      }
    })

    await use(page)

    // Assert no unexpected console errors
    expect(errorMessages).toEqual([])
  },
})

/**
 * Extended test fixture that automatically verifies hydration at the end.
 * Use this for tests where you want to confirm React hydration succeeded.
 */
export const testWithHydration = test.extend({
  page: async ({ page }, use) => {
    await use(page)

    // Automatically verify hydration at the end of the test
    await verifyHydration(page)
  },
})

// Re-export expect for convenience
export { expect }
