import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test('merge-middleware-context', async ({ page }) => {
  await page.goto('/merge-middleware-context')

  await page.waitForLoadState('networkidle')

  await page.getByTestId('test-middleware-context-btn').click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('has-test-parent')).toContainText('true')
  await expect(page.getByTestId('has-test')).toContainText('true')

  const contextResult = await page.getByTestId('context-result').textContent()
  expect(contextResult).toContain('testParent')
  expect(contextResult).toContain('test')
})

test.describe('HEAD fallback', () => {
  test('strips body and preserves headers when falling back to GET', async ({
    page,
  }) => {
    await page.goto('/')
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/head-fallback', { method: 'HEAD' })
      return {
        status: res.status,
        contentType: res.headers.get('content-type'),
        body: await res.text(),
      }
    })
    expect(result.status).toBe(200)
    expect(result.contentType).toBe('application/xml; charset=utf-8')
    expect(result.body).toBe('')
  })

  test('strips body and preserves headers when falling back to ANY', async ({
    page,
  }) => {
    await page.goto('/')
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/only-any', { method: 'HEAD' })
      return {
        status: res.status,
        xHandler: res.headers.get('x-handler'),
        xMethod: res.headers.get('x-method'),
        body: await res.text(),
      }
    })
    expect(result.status).toBe(200)
    expect(result.xHandler).toBe('ANY')
    expect(result.xMethod).toBe('HEAD')
    expect(result.body).toBe('')
  })

  test('prefers GET over ANY for HEAD requests', async ({ page }) => {
    await page.goto('/')
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/get-and-any', { method: 'HEAD' })
      return {
        status: res.status,
        xHandler: res.headers.get('x-handler'),
        body: await res.text(),
      }
    })
    expect(result.status).toBe(200)
    expect(result.xHandler).toBe('GET')
    expect(result.body).toBe('')
  })

  test('preserves Location header when GET handler returns a redirect', async ({
    page,
  }) => {
    await page.goto('/')
    // HEAD /api/head-redirect-fallback → server returns 307 Location:/api/head-fallback
    // Browser follows the redirect: HEAD /api/head-fallback → 200 with correct headers
    // If the Location header were lost, the browser could not follow and would see a 307.
    const result = await page.evaluate(async () => {
      const res = await fetch('/api/head-redirect-fallback', { method: 'HEAD' })
      return {
        status: res.status,
        contentType: res.headers.get('content-type'),
        body: await res.text(),
      }
    })
    expect(result.status).toBe(200)
    expect(result.contentType).toBe('application/xml; charset=utf-8')
    expect(result.body).toBe('')
  })
})

test.describe('methods', () => {
  test('only ANY', async ({ page }) => {
    await page.goto('/methods/only-any')

    // wait for page to be loaded by waiting for the route component to be rendered
    await expect(page.getByTestId('route-component')).toBeInViewport()

    const testCases = await page
      .locator('[data-testid^="expected-"]')
      .elementHandles()
    expect(testCases.length).not.toBe(0)
    for (const testCase of testCases) {
      const testId = await testCase.getAttribute('data-testid')

      if (!testId) {
        throw new Error('testcase is missing data-testid')
      }

      const suffix = testId.replace('expected-', '')

      const expected =
        (await page.getByTestId(`expected-${suffix}`).textContent()) || ''
      expect(expected).not.toBe('')

      await expect(page.getByTestId(`result-${suffix}`)).toContainText(expected)
    }
  })
})
