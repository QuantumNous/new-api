import queryString from 'node:querystring'
import { expect, type Page } from '@playwright/test'
import combinateImport from 'combinate'
import {
  getDummyServerPort,
  getTestServerPort,
  test,
} from '@tanstack/router-e2e-utils'
import { getE2EPortKey } from './utils/getE2EPortKey.ts'

// somehow playwright does not correctly import default exports
const combinate = (combinateImport as any).default as typeof combinateImport
const e2ePortKey = getE2EPortKey()

const PORT = await getTestServerPort(e2ePortKey)

const EXTERNAL_HOST_PORT = await getDummyServerPort(e2ePortKey)
const POSTS_URL = `http://localhost:${PORT}/posts`

async function waitForRouterIdle(page: Page) {
  await expect(page.getByTestId('router-isLoading')).toHaveText('false')
  await expect(page.getByTestId('router-status')).toHaveText('idle')
}

async function waitForPostsIndex(page: Page) {
  await page.waitForURL(POSTS_URL)
  expect(page.url()).toBe(POSTS_URL)
  await waitForRouterIdle(page)
  await expect(page.getByTestId('PostsIndexComponent')).toBeInViewport()
}

test.describe('redirects', () => {
  test.describe('internal', () => {
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
          await page.goto(
            `/redirect/internal${preload === false ? '?preload=false' : ''}`,
          )

          const link = page.getByTestId(
            `via-${thrower}${reloadDocument ? '-reloadDocument' : ''}`,
          )

          await waitForRouterIdle(page)
          let requestHappened = false

          const requestPromise = new Promise<void>((resolve) => {
            page.on('request', (request) => {
              if (
                request.url().startsWith(`http://localhost:${PORT}/_serverFn/`)
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
          expect(requestHappened).toBe(expectRequestHappened)
          let fullPageLoad = false
          page.on('domcontentloaded', () => {
            fullPageLoad = true
          })

          await link.click()

          await waitForPostsIndex(page)
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
        await page.goto(`/redirect/internal/via-${thrower}`)

        await waitForPostsIndex(page)
      })
    })
  })

  test.describe('external', () => {
    const externalTestMatrix = combinate({
      scenario: ['navigate', 'direct_visit'] as const,
      thrower: ['beforeLoad', 'loader'] as const,
    })

    externalTestMatrix.forEach(({ scenario, thrower }) => {
      test(`external target: scenario: ${scenario}, thrower: ${thrower}`, async ({
        page,
      }) => {
        const q = queryString.stringify({
          externalHost: `http://localhost:${EXTERNAL_HOST_PORT}/`,
        })

        if (scenario === 'navigate') {
          await page.goto(`/redirect/external?${q}`)
          await waitForRouterIdle(page)
          const link = page.getByTestId(`via-${thrower}`)
          await link.focus()
          await link.click()
        } else {
          await page.goto(`/redirect/external/via-${thrower}?${q}`)
        }

        const url = `http://localhost:${EXTERNAL_HOST_PORT}/`

        await page.waitForURL(url)
        expect(page.url()).toBe(url)
      })
    })
  })

  test.describe('serverFn', () => {
    const serverFnTestMatrix = combinate({
      target: ['internal', 'external'] as const,
      scenario: ['navigate', 'direct_visit'] as const,
      thrower: ['beforeLoad', 'loader'] as const,
      reloadDocument: [false, true] as const,
    })

    serverFnTestMatrix.forEach(
      ({ target, thrower, scenario, reloadDocument }) => {
        test(`serverFn redirects to target: ${target}, scenario: ${scenario}, thrower: ${thrower}, reloadDocument: ${reloadDocument}`, async ({
          page,
        }) => {
          let fullPageLoad = false
          const q = queryString.stringify({
            externalHost: `http://localhost:${EXTERNAL_HOST_PORT}/`,
            reloadDocument,
          })

          if (scenario === 'navigate') {
            await page.goto(`/redirect/${target}/serverFn?${q}`)
            await waitForRouterIdle(page)

            const link = page.getByTestId(
              `via-${thrower}${reloadDocument ? '-reloadDocument' : ''}`,
            )

            page.on('domcontentloaded', () => {
              fullPageLoad = true
            })

            await link.focus()
            await waitForRouterIdle(page)
            await link.click()
          } else {
            await page.goto(`/redirect/${target}/serverFn/via-${thrower}?${q}`)
          }

          const url =
            target === 'internal'
              ? POSTS_URL
              : `http://localhost:${EXTERNAL_HOST_PORT}/`

          await page.waitForURL(url)

          expect(page.url()).toBe(url)

          if (target === 'internal' && scenario === 'navigate') {
            await waitForRouterIdle(page)
            await expect(
              page.getByTestId('PostsIndexComponent'),
            ).toBeInViewport()
            expect(fullPageLoad).toBe(reloadDocument)
          }
        })
      },
    )
  })

  test.describe('useServerFn', () => {
    const useServerFnTestMatrix = combinate({
      target: ['internal', 'external'] as const,
      reloadDocument: [false, true] as const,
    })

    useServerFnTestMatrix.forEach(({ target, reloadDocument }) => {
      test(`useServerFn redirects to target: ${target}, reloadDocument: ${reloadDocument}`, async ({
        page,
      }) => {
        const q = queryString.stringify({
          externalHost: `http://localhost:${EXTERNAL_HOST_PORT}/`,
          reloadDocument,
        })

        await page.goto(`/redirect/${target}/serverFn/via-useServerFn?${q}`)

        await waitForRouterIdle(page)

        const button = page.getByTestId('redirect-on-click')

        let fullPageLoad = false
        page.on('domcontentloaded', () => {
          fullPageLoad = true
        })

        await button.click()

        const url =
          target === 'internal'
            ? POSTS_URL
            : `http://localhost:${EXTERNAL_HOST_PORT}/`
        await page.waitForURL(url)
        expect(page.url()).toBe(url)
        if (target === 'internal') {
          await waitForRouterIdle(page)
          await expect(page.getByTestId('PostsIndexComponent')).toBeInViewport()
          expect(fullPageLoad).toBe(reloadDocument)
        }
      })
    })
  })

  test('multiple Set-Cookie headers are preserved on redirect', async ({
    page,
  }) => {
    // This test verifies that multiple Set-Cookie headers are not lost during redirect
    await page.goto('/multi-cookie-redirect')

    // Wait for redirect to complete
    await page.waitForURL(/\/multi-cookie-redirect\/target/)

    // Should redirect to target page
    await expect(page.getByTestId('multi-cookie-redirect-target')).toBeVisible()
    expect(page.url()).toContain('/multi-cookie-redirect/target')

    // Verify all three cookies were preserved during the redirect
    await expect(page.getByTestId('cookie-session')).toHaveText('session-value')
    await expect(page.getByTestId('cookie-csrf')).toHaveText('csrf-token-value')
    await expect(page.getByTestId('cookie-theme')).toHaveText('dark')
  })
})
