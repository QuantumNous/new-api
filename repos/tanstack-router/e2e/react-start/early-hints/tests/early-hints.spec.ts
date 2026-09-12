import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import type { Page } from '@playwright/test'

type ResourceTiming = {
  name: string
  initiatorType: string
}

type EarlyHintsCdpEvent = {
  headers: Record<string, unknown>
}

async function getResourceTimings(page: Page): Promise<Array<ResourceTiming>> {
  return page.evaluate(() =>
    performance.getEntriesByType('resource').map((entry) => {
      const resource = entry as PerformanceResourceTiming
      return {
        name: resource.name,
        initiatorType: resource.initiatorType,
      }
    }),
  )
}

function getHeader(headers: Record<string, unknown>, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()]

  return Array.isArray(value)
    ? value.join(', ')
    : typeof value === 'string'
      ? value
      : ''
}

test.describe('Early Hints - Browser Integration', () => {
  test('passes Early Hints link headers to Chromium', async ({ page }) => {
    const client = await page.context().newCDPSession(page)
    const earlyHints: Array<EarlyHintsCdpEvent> = []

    client.on('Network.responseReceivedEarlyHints', (event) => {
      earlyHints.push(event as EarlyHintsCdpEvent)
    })
    await client.send('Network.enable')

    await page.goto('/')
    await expect(page.getByTestId('home')).toBeVisible()

    expect(earlyHints).toHaveLength(1)

    const link = getHeader(earlyHints[0]!.headers, 'link')
    expect(link).toContain('rel=modulepreload; as=script')
    expect(link).toContain('<https://early-hints.test>; rel=preconnect')
  })

  test('app loads correctly with early hints enabled', async ({ page }) => {
    await page.goto('/parent/child/grandchild')
    await expect(page.getByTestId('grandchild')).toBeVisible()
    await expect(page.getByTestId('parent')).toBeVisible()
    await expect(page.getByTestId('child')).toBeVisible()
  })

  test('deep nested route loads route CSS assets', async ({ page }) => {
    await page.goto('/parent/child/grandchild')
    await expect(page.getByTestId('grandchild')).toBeVisible()

    const cssResources = await getResourceTimings(page)
    expect(
      cssResources.some((entry) =>
        /\/assets\/parent-[^/]+\.css$/.test(entry.name),
      ),
    ).toBe(true)
    expect(
      cssResources.some((entry) =>
        /\/assets\/child-[^/]+\.css$/.test(entry.name),
      ),
    ).toBe(true)
    expect(
      cssResources.some((entry) =>
        /\/assets\/grandchild-[^/]+\.css$/.test(entry.name),
      ),
    ).toBe(true)
  })

  test('navigation works with early hints enabled', async ({ page }) => {
    await page.goto('/other/nested')
    await expect(page.getByTestId('nested')).toBeVisible()
    await expect(page.getByTestId('other')).toBeVisible()
  })
})

test.describe('Early Hints - Server Verification', () => {
  test('server handles HTML requests with early hints enabled', async ({
    request,
  }) => {
    const response = await request.get('/')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/html')
  })
})
