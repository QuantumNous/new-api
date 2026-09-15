import { test as base, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export interface TestFixtureOptions {
  /**
   * List of error message patterns to ignore in console output.
   * Supports both strings (substring match) and RegExp patterns.
   *
   * @example
   * test.use({
   *   whitelistErrors: [
   *     'Failed to load resource: net::ERR_NAME_NOT_RESOLVED',
   *     /Failed to load resource/,
   *   ],
   * })
   */
  whitelistErrors: Array<RegExp | string>
}
export const test = base.extend<TestFixtureOptions>({
  whitelistErrors: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use([])
    },
    { option: true },
  ],
  page: async ({ page, whitelistErrors }, use) => {
    const errorMessages: Array<string> = []
    // Ensure whitelistErrors is always an array (defensive fallback)
    const errors = Array.isArray(whitelistErrors) ? whitelistErrors : []
    page.on('console', (m) => {
      if (m.type() === 'error') {
        const text = m.text()
        for (const whitelistError of errors) {
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
    expect(errorMessages).toEqual([])
  },
})

export function collectBrowserErrors(page: Page): Array<string> {
  const browserErrors: Array<string> = []

  page.on('pageerror', (error) => {
    browserErrors.push(error.message)
  })

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserErrors.push(message.text())
    }
  })

  page.on('requestfailed', (request) => {
    browserErrors.push(
      `${request.url()} ${request.failure()?.errorText ?? 'failed'}`,
    )
  })

  return browserErrors
}
