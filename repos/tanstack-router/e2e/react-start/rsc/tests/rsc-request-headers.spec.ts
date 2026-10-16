import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.describe('RSC Request Headers Tests', () => {
  test('loader server functions can read cookies with vite-rsc enabled', async ({
    page,
    context,
  }) => {
    await context.setExtraHTTPHeaders({
      Cookie: 'session=abc123; theme=dark',
    })

    const response = await page.goto('/rsc-request-headers')
    await page.waitForURL('/rsc-request-headers')

    expect(response?.status()).toBe(200)

    await expect(page.getByTestId('rsc-request-headers-title')).toHaveText(
      'RSC Request Headers',
    )
    await expect(page.getByTestId('rsc-request-headers-cookies')).toContainText(
      'session=abc123',
    )
    await expect(page.getByTestId('rsc-request-headers-cookies')).toContainText(
      'theme=dark',
    )
  })
})
