import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC useServerFn Tests', () => {
  test('useServerFn can be imported and called in an RSC app', async ({
    page,
  }) => {
    await page.goto('/rsc-use-server-fn')
    await page.waitForURL('/rsc-use-server-fn')
    await waitForHydration(page)

    await expect(page.getByTestId('rsc-use-server-fn-title')).toHaveText(
      'useServerFn with RSC',
    )

    await page.getByTestId('rsc-use-server-fn-button').click()
    await expect(page.getByTestId('rsc-use-server-fn-message')).toHaveText(
      'useServerFn works with RSC builds',
    )
  })
})
