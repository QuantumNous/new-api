import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.describe('RSC Direct Loader Tests', () => {
  test('direct loader return does not trigger notFound handling', async ({
    page,
  }) => {
    const response = await page.goto('/rsc-direct-loader')
    await page.waitForURL('/rsc-direct-loader')

    expect(response?.status()).toBe(200)

    await expect(page.getByTestId('rsc-direct-loader-title')).toHaveText(
      'Direct Loader Return',
    )
    await expect(page.getByTestId('rsc-direct-loader-content')).toBeVisible()
    await expect(page.getByTestId('rsc-direct-loader-heading')).toHaveText(
      'Direct loader RSC',
    )
  })
})
