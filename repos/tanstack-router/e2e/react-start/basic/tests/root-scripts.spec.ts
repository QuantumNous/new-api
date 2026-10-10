import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

// All user-rendered scripts added in __root.tsx (not via head() API)
const ALL_USER_SCRIPTS = [
  'USER_SCRIPT', // <script src="user-script.js" /> after <Scripts />
  'ASYNC_USER_SCRIPT', // <script src="async-user-script.js" async /> after <Scripts />
  'HEAD_SCRIPT', // <script src="head-script.js" /> in <head>
  'HEAD_ASYNC_SCRIPT', // <script src="head-async-script.js" async /> in <head>
  'BEFORE_SCRIPTS_SCRIPT', // <script src="before-scripts-script.js" /> before <Scripts />
  'BEFORE_SCRIPTS_ASYNC_SCRIPT', // <script src="before-scripts-async-script.js" async /> before <Scripts />
] as const

test.describe('User-rendered scripts in __root.tsx', () => {
  test('should not cause hydration errors on SSR load', async ({ page }) => {
    const consoleErrors: Array<string> = []
    page.on('console', (m) => {
      if (m.type() === 'error') {
        consoleErrors.push(m.text())
      }
    })

    await page.goto('/')

    // All user-rendered scripts should have executed
    for (const scriptVar of ALL_USER_SCRIPTS) {
      await page.waitForFunction(
        (v) => (window as any)[v] === true,
        scriptVar,
        { timeout: 5000 },
      )
    }

    // Assert no hydration errors occurred
    const hydrationErrors = consoleErrors.filter(
      (e) =>
        e.includes('Hydration') ||
        e.includes('hydration') ||
        e.includes("didn't match"),
    )
    expect(hydrationErrors).toEqual([])
  })

  test('should execute on client-side navigation to another route', async ({
    page,
  }) => {
    await page.goto('/posts')

    await page.getByRole('link', { name: 'Home' }).click()
    await expect(page.getByText('Welcome Home!!!')).toBeInViewport()

    // Root layout scripts should have executed during the initial page load
    for (const scriptVar of ALL_USER_SCRIPTS) {
      await page.waitForFunction(
        (v) => (window as any)[v] === true,
        scriptVar,
        { timeout: 5000 },
      )
    }
  })
})
