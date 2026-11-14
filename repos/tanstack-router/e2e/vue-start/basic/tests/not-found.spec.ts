import { expect } from '@playwright/test'
import combinateImport from 'combinate'
import { test } from '@tanstack/router-e2e-utils'
import { isSpaMode } from './utils/isSpaMode'

// somehow playwright does not correctly import default exports
const combinate = (combinateImport as any).default as typeof combinateImport

test.use({
  whitelistErrors: [
    'Failed to load resource: the server responded with a status of 404',
  ],
})
test.describe('not-found', () => {
  test(`global not found`, async ({ page }) => {
    const response = await page.goto(`/this-page-does-not-exist/foo/bar`)

    expect(response?.status()).toBe(isSpaMode ? 200 : 404)

    await expect(
      page.getByTestId('default-not-found-component'),
    ).toBeInViewport()
  })

  test.describe('throw notFound()', () => {
    const navigationTestMatrix = combinate({
      thrower: ['beforeLoad', 'loader'] as const,
      preload: [false, true] as const,
    })

    navigationTestMatrix.forEach(({ thrower, preload }) => {
      test(`navigation: thrower: ${thrower}, preload: ${preload}`, async ({
        page,
      }) => {
        await page.goto(
          `/not-found/${preload === false ? '?preload=false' : ''}`,
        )
        const link = page.getByTestId(`via-${thrower}`)

        if (preload) {
          await link.focus()
          await new Promise((r) => setTimeout(r, 250))
        }

        await link.click()

        await expect(
          page.getByTestId(`via-${thrower}-notFound-component`),
        ).toBeInViewport()
        await expect(
          page.getByTestId(`via-${thrower}-route-component`),
        ).not.toBeInViewport()
      })
    })
    const directVisitTestMatrix = combinate({
      thrower: ['beforeLoad', 'loader'] as const,
    })

    directVisitTestMatrix.forEach(({ thrower }) => {
      test(`direct visit: thrower: ${thrower}`, async ({ page }) => {
        await page.goto(`/not-found/via-${thrower}`)
        await page.waitForLoadState('networkidle')
        await expect(
          page.getByTestId(`via-${thrower}-notFound-component`),
        ).toBeInViewport()
        await expect(
          page.getByTestId(`via-${thrower}-route-component`),
        ).not.toBeInViewport()
      })
    })

    test('direct visit: child beforeLoad notFound renders parent boundary with parent loader data', async ({
      page,
    }) => {
      await page.goto('/not-found/parent-boundary/via-beforeLoad')
      await page.waitForLoadState('networkidle')

      await expect(
        page.getByTestId('parent-boundary-notFound-component'),
      ).toBeInViewport()
      await expect(page.getByTestId('parent-loader-data')).toHaveText('ready')
      await expect(
        page.getByTestId('parent-boundary-child-route-component'),
      ).not.toBeInViewport()
    })

    test('direct visit: beforeLoad notFound with routeId targets root boundary', async ({
      page,
    }) => {
      await page.goto('/not-found/via-beforeLoad-target-root')
      await page.waitForLoadState('networkidle')

      await expect(
        page.getByTestId('default-not-found-component'),
      ).toBeInViewport()
      await expect(
        page.getByTestId('via-beforeLoad-target-root-route-component'),
      ).not.toBeInViewport()
    })
  })
})
