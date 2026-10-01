import { expect, Page } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

type NavigationMethod = 'direct' | 'client-side'

async function navigateToRoute(
  page: Page,
  route: string,
  linkTestId: string,
  method: NavigationMethod,
) {
  if (method === 'direct') {
    await page.goto(route)
  } else {
    // Client-side navigation: go to home first, then click link
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByTestId(linkTestId).click()
  }
  await page.waitForLoadState('networkidle')
}

async function testSimpleMiddlewareDeduplication(
  page: Page,
  method: NavigationMethod,
) {
  await navigateToRoute(page, '/simple', 'link-simple', method)

  // Check that both global middlewares were executed
  await expect(page.getByTestId('global-middleware-executed')).toContainText(
    'true',
  )
  await expect(page.getByTestId('global-middleware-2-executed')).toContainText(
    'true',
  )

  // Check that deduplication worked - each global middleware should execute exactly once
  const expectedGlobalCount = await page
    .getByTestId('expected-global-count')
    .textContent()
  const actualGlobalCount = await page.getByTestId('global-count').textContent()

  // Extract the count number from the text
  const actualCount = actualGlobalCount?.match(/\d+/)?.[0] || '0'

  expect(actualCount).toBe(expectedGlobalCount)

  // Check the deduplication status
  await expect(page.getByTestId('deduplication-status')).toContainText('PASS')
}

async function testMultipleServerFunctionsDeduplication(
  page: Page,
  method: NavigationMethod,
) {
  await navigateToRoute(
    page,
    '/multiple-server-functions',
    'link-multiple',
    method,
  )

  // For SSR (direct): all server functions run in same request, counts accumulate
  // For client-side: each server function is a separate HTTP request
  // The key thing we're testing is that middleware is deduped WITHIN each server fn call

  // Check overall status - the component handles both cases
  await expect(page.getByTestId('overall-status')).toContainText('PASS')

  // For direct navigation, verify the accumulated counts
  if (method === 'direct') {
    const expectedGlobalCount = await page
      .getByTestId('expected-global-count')
      .textContent()
    const actualGlobalCount = await page
      .getByTestId('actual-global-count')
      .textContent()
    expect(actualGlobalCount).toBe(expectedGlobalCount)

    const expectedGlobal2Count = await page
      .getByTestId('expected-global-2-count')
      .textContent()
    const actualGlobal2Count = await page
      .getByTestId('actual-global-2-count')
      .textContent()
    expect(actualGlobal2Count).toBe(expectedGlobal2Count)

    const expectedLocalCount = await page
      .getByTestId('expected-local-count')
      .textContent()
    const actualLocalCount = await page
      .getByTestId('actual-local-count')
      .textContent()
    expect(actualLocalCount).toBe(expectedLocalCount)

    // Verify the status indicators
    await expect(page.getByTestId('global-status')).toContainText('✓')
    await expect(page.getByTestId('global-2-status')).toContainText('✓')
    await expect(page.getByTestId('local-status')).toContainText('✓')
  }
}

test.describe('Global middleware deduplication (issue #5239)', () => {
  test.describe('direct navigation (SSR)', () => {
    test('simple test - global middleware attached to server function should be deduped', async ({
      page,
    }) => {
      await testSimpleMiddlewareDeduplication(page, 'direct')
    })

    test('multiple server functions - global middleware should be deduped per function call', async ({
      page,
    }) => {
      await testMultipleServerFunctionsDeduplication(page, 'direct')
    })
  })

  test.describe('client-side navigation', () => {
    test('simple test - global middleware attached to server function should be deduped', async ({
      page,
    }) => {
      await testSimpleMiddlewareDeduplication(page, 'client-side')
    })

    test('multiple server functions - global middleware should be deduped per function call', async ({
      page,
    }) => {
      await testMultipleServerFunctionsDeduplication(page, 'client-side')
    })
  })
})

test.describe('Request middleware pathname (issue #6647)', () => {
  test('pathname should be the page path on SSR', async ({ page }) => {
    await page.goto('/pathname-middleware')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('request-middleware-pathname')).toHaveText(
      '/pathname-middleware',
    )
  })

  test('pathname should be the server function path on client-side navigation', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByTestId('link-pathname').click()
    await page.waitForLoadState('networkidle')
    const pathnameText = await page
      .getByTestId('request-middleware-pathname')
      .textContent()
    expect(pathnameText).toBeTruthy()
    expect(pathnameText!.startsWith('/_serverFn/')).toBe(true)
  })
})

test.describe('Client sendContext collisions (TSR-003)', () => {
  test('trusted server middleware context wins for SSR, GET, and FormData calls', async ({
    page,
  }) => {
    await page.goto('/context-collision')
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('loader-status')).toHaveText('PASS')
    await expect(page.getByTestId('loader-trusted-user')).toHaveText(
      'server-user',
    )
    await expect(page.getByTestId('loader-client-nonce')).toHaveText(
      'client-nonce',
    )

    await page.getByTestId('invoke-get-collision').click()
    await expect(page.getByTestId('get-status')).toHaveText('PASS')
    await expect(page.getByTestId('get-trusted-user')).toHaveText('server-user')
    await expect(page.getByTestId('get-client-nonce')).toHaveText(
      'client-nonce',
    )

    await page.getByTestId('invoke-post-collision').click()
    await expect(page.getByTestId('post-status')).toHaveText('PASS')
    await expect(page.getByTestId('post-trusted-user')).toHaveText(
      'server-user',
    )
    await expect(page.getByTestId('post-client-nonce')).toHaveText(
      'client-nonce',
    )
  })
})
