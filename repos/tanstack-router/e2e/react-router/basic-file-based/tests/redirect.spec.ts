import queryString from 'node:querystring'
import { expect, test } from '@playwright/test'
import combinateImport from 'combinate'
import {
  getDummyServerPort,
  getTestServerPort,
} from '@tanstack/router-e2e-utils'
import packageJson from '../package.json' with { type: 'json' }

// somehow playwright does not correctly import default exports
const combinate = (combinateImport as any).default as typeof combinateImport

const PORT = await getTestServerPort(packageJson.name)
const EXTERNAL_HOST_PORT = await getDummyServerPort(packageJson.name)

test.describe('redirects', () => {
  const internalNavigationTestMatrix = combinate({
    thrower: ['beforeLoad', 'loader'] as const,
    reloadDocument: [false, true] as const,
    preload: [false, true] as const,
  })

  internalNavigationTestMatrix.forEach(
    ({ thrower, reloadDocument, preload }) => {
      test(`internal target, navigation: thrower: ${thrower}, reloadDocument: ${reloadDocument}, preload: ${preload}`, async ({
        page,
      }) => {
        await page.waitForLoadState('networkidle')
        await page.goto(
          `/redirect/internal${preload === false ? '?preload=false' : ''}`,
        )
        const link = page.getByTestId(
          `via-${thrower}${reloadDocument ? '-reloadDocument' : ''}`,
        )

        await page.waitForLoadState('networkidle')
        let requestHappened = false

        const requestPromise = new Promise<void>((resolve) => {
          page.on('request', (request) => {
            if (
              request.url() === `http://localhost:${EXTERNAL_HOST_PORT}/posts`
            ) {
              requestHappened = true
              resolve()
            }
          })
        })
        await link.focus()

        const expectRequestHappened = preload && !reloadDocument
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(resolve, expectRequestHappened ? 5000 : 500),
        )
        await Promise.race([requestPromise, timeoutPromise])
        await page.waitForLoadState('networkidle')
        expect(requestHappened).toBe(expectRequestHappened)
        await link.click()
        let fullPageLoad = false
        page.on('domcontentloaded', () => {
          fullPageLoad = true
        })

        const url = `http://localhost:${PORT}/posts`

        await page.waitForURL(url)
        if (reloadDocument) {
          await page.waitForLoadState('domcontentloaded')
        }
        expect(page.url()).toBe(url)
        await expect(page.getByTestId('PostsIndexComponent')).toBeInViewport()
        expect(fullPageLoad).toBe(reloadDocument)
      })
    },
  )

  const internalDirectVisitTestMatrix = combinate({
    thrower: ['beforeLoad', 'loader'] as const,
    reloadDocument: [false, true] as const,
  })

  internalDirectVisitTestMatrix.forEach(({ thrower, reloadDocument }) => {
    test(`internal target, direct visit: thrower: ${thrower}, reloadDocument: ${reloadDocument}`, async ({
      page,
    }) => {
      await page.waitForLoadState('networkidle')

      await page.goto(`/redirect/internal/via-${thrower}`)

      const url = `http://localhost:${PORT}/posts`

      await page.waitForURL(url)
      expect(page.url()).toBe(url)
      await page.waitForLoadState('networkidle')
      await expect(page.getByTestId('PostsIndexComponent')).toBeInViewport()
    })
  })

  const externalTestMatrix = combinate({
    scenario: ['navigate', 'direct_visit'] as const,
    thrower: ['beforeLoad', 'loader'] as const,
  })

  externalTestMatrix.forEach(({ scenario, thrower }) => {
    test(`external target: scenario: ${scenario}, thrower: ${thrower}`, async ({
      page,
    }) => {
      await page.waitForLoadState('networkidle')

      const q = queryString.stringify({
        externalHost: `http://localhost:${EXTERNAL_HOST_PORT}/`,
      })

      if (scenario === 'navigate') {
        await page.goto(`/redirect/external?${q}`)
        await page.getByTestId(`via-${thrower}`).click()
      } else {
        await page.goto(`/redirect/external/via-${thrower}?${q}`)
      }

      const url = `http://localhost:${EXTERNAL_HOST_PORT}/`

      await page.waitForURL(url)
      expect(page.url()).toBe(url)
    })
  })

  test('regression test for #3097', async ({ page }) => {
    await page.goto(`/redirect/preload/first`)
    const link = page.getByTestId(`link`)
    await link.focus()
    await link.click()
    await page.waitForURL('/redirect/preload/third')
    await expect(page.getByTestId(`third`)).toBeInViewport()
  })

  // Tests for Route.redirect() method - tests relative redirects
  test.describe('Route.redirect()', () => {
    const routeRedirectInternalTestMatrix = combinate({
      thrower: ['beforeLoad', 'loader'] as const,
    })

    // Test internal relative redirects (the key feature being tested)
    routeRedirectInternalTestMatrix.forEach(({ thrower }) => {
      test(`internal target (relative redirect), navigation: thrower: ${thrower}`, async ({
        page,
      }) => {
        await page.goto('/redirect/internal')
        await page.waitForLoadState('networkidle')

        const link = page.getByTestId(`via-route-redirect-${thrower}`)
        await link.click()

        // Should redirect to the relative ./destination route
        const url = `http://localhost:${PORT}/redirect/internal/destination`
        await page.waitForURL(url)
        expect(page.url()).toBe(url)
        await expect(page.getByTestId('redirect-destination')).toBeInViewport()
      })
    })

    routeRedirectInternalTestMatrix.forEach(({ thrower }) => {
      test(`internal target (relative redirect), direct visit: thrower: ${thrower}`, async ({
        page,
      }) => {
        await page.goto(`/redirect/internal/via-route-redirect-${thrower}`)

        // Should redirect to the relative ./destination route
        const url = `http://localhost:${PORT}/redirect/internal/destination`
        await page.waitForURL(url)
        expect(page.url()).toBe(url)
        await expect(page.getByTestId('redirect-destination')).toBeInViewport()
      })
    })

    // Test external redirects still work with Route.redirect()
    const externalRouteRedirectTestMatrix = combinate({
      scenario: ['navigate', 'direct_visit'] as const,
      thrower: ['beforeLoad', 'loader'] as const,
    })

    externalRouteRedirectTestMatrix.forEach(({ scenario, thrower }) => {
      test(`external target: scenario: ${scenario}, thrower: ${thrower}`, async ({
        page,
      }) => {
        const q = queryString.stringify({
          externalHost: `http://localhost:${EXTERNAL_HOST_PORT}/`,
        })

        if (scenario === 'navigate') {
          await page.goto(`/redirect/external?${q}`)
          await page.waitForLoadState('networkidle')
          await page.getByTestId(`via-route-redirect-${thrower}`).click()
        } else {
          await page.goto(
            `/redirect/external/via-route-redirect-${thrower}?${q}`,
          )
        }

        const url = `http://localhost:${EXTERNAL_HOST_PORT}/`
        await page.waitForURL(url)
        expect(page.url()).toBe(url)
      })
    })
  })

  // Tests for getRouteApi().redirect() method - tests relative redirects
  test.describe('getRouteApi().redirect()', () => {
    const routeApiRedirectInternalTestMatrix = combinate({
      thrower: ['beforeLoad', 'loader'] as const,
    })

    // Test internal relative redirects (the key feature being tested)
    routeApiRedirectInternalTestMatrix.forEach(({ thrower }) => {
      test(`internal target (relative redirect), navigation: thrower: ${thrower}`, async ({
        page,
      }) => {
        await page.goto('/redirect/internal')
        await page.waitForLoadState('networkidle')

        const link = page.getByTestId(`via-routeApi-redirect-${thrower}`)
        await link.click()

        // Should redirect to the relative ./destination route
        const url = `http://localhost:${PORT}/redirect/internal/destination`
        await page.waitForURL(url)
        expect(page.url()).toBe(url)
        await expect(page.getByTestId('redirect-destination')).toBeInViewport()
      })
    })

    routeApiRedirectInternalTestMatrix.forEach(({ thrower }) => {
      test(`internal target (relative redirect), direct visit: thrower: ${thrower}`, async ({
        page,
      }) => {
        await page.goto(`/redirect/internal/via-routeApi-redirect-${thrower}`)

        // Should redirect to the relative ./destination route
        const url = `http://localhost:${PORT}/redirect/internal/destination`
        await page.waitForURL(url)
        expect(page.url()).toBe(url)
        await expect(page.getByTestId('redirect-destination')).toBeInViewport()
      })
    })

    // Test external redirects still work with getRouteApi().redirect()
    const externalRouteApiRedirectTestMatrix = combinate({
      scenario: ['navigate', 'direct_visit'] as const,
      thrower: ['beforeLoad', 'loader'] as const,
    })

    externalRouteApiRedirectTestMatrix.forEach(({ scenario, thrower }) => {
      test(`external target: scenario: ${scenario}, thrower: ${thrower}`, async ({
        page,
      }) => {
        const q = queryString.stringify({
          externalHost: `http://localhost:${EXTERNAL_HOST_PORT}/`,
        })

        if (scenario === 'navigate') {
          await page.goto(`/redirect/external?${q}`)
          await page.waitForLoadState('networkidle')
          await page.getByTestId(`via-routeApi-redirect-${thrower}`).click()
        } else {
          await page.goto(
            `/redirect/external/via-routeApi-redirect-${thrower}?${q}`,
          )
        }

        const url = `http://localhost:${EXTERNAL_HOST_PORT}/`
        await page.waitForURL(url)
        expect(page.url()).toBe(url)
      })
    })
  })
})
