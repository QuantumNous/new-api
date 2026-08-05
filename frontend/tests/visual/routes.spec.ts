import { expect, test } from '@playwright/test'

import {
  assertInteractiveCentersVisible,
  assertNoHorizontalOverflow,
  configureStablePage,
  freezeAndInspectHomeCanvas,
  waitForStablePage,
} from './fixtures'
import { VISUAL_ROUTES } from './routes'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 1024, height: 820 },
  { name: 'mobile', width: 390, height: 844 },
] as const

const ROUTE_SMOKE_TIMEOUT = 120_000

for (const viewport of viewports) {
  test(`all routes smoke at ${viewport.name}`, async ({ page }) => {
    test.setTimeout(ROUTE_SMOKE_TIMEOUT)
    await page.setViewportSize(viewport)
    await configureStablePage(page, {
      theme: 'dark',
      routeAwareAuth: true,
    })

    const runtimeErrors: string[] = []
    page.on('pageerror', (error) => runtimeErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'warning' || message.type() === 'error') {
        runtimeErrors.push(`${message.type()}: ${message.text()}`)
      }
    })
    page.on('requestfailed', (request) => {
      const failure = request.failure()?.errorText || 'request failed'
      if (
        request.url().startsWith('http://127.0.0.1:') &&
        !failure.includes('ERR_ABORTED')
      ) {
        runtimeErrors.push(`${request.method()} ${request.url()}: ${failure}`)
      }
    })

    for (const route of VISUAL_ROUTES) {
      runtimeErrors.length = 0
      await test.step(`${route.name} ${route.path}`, async () => {
        await page.goto(route.path, { waitUntil: 'domcontentloaded' })
        await waitForStablePage(page)
        if (route.path === '/') await freezeAndInspectHomeCanvas(page)
        await assertNoHorizontalOverflow(page)
        await assertInteractiveCentersVisible(page)
        expect(runtimeErrors, `runtime failures on ${route.path}`).toEqual([])
      })
    }
  })
}
