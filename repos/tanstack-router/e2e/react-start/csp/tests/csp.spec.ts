import { expect, type Page } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

async function getRawHtml(page: Page) {
  let rawHtml = ''

  await page.route('/', async (route) => {
    const response = await route.fetch()
    rawHtml = await response.text()
    await route.fulfill({ response, body: rawHtml })
  })

  const response = await page.goto('/')
  await page.unrouteAll({ behavior: 'ignoreErrors' })

  return { rawHtml, response }
}

test('CSP header is set with nonce', async ({ page }) => {
  const response = await page.goto('/')
  const csp = response?.headers()['content-security-policy']
  expect(csp).toContain("script-src 'self' 'nonce-")
  expect(csp).toContain("style-src 'self' 'nonce-")
})

test('Inline scripts have nonce attribute', async ({ page }) => {
  await page.goto('/')
  const scripts = await page.locator('script[nonce]').all()
  expect(scripts.length).toBeGreaterThan(0)
})

test('Inline styles have nonce attribute', async ({ page }) => {
  await page.goto('/')
  const styles = await page.locator('style[nonce]').all()
  expect(styles.length).toBeGreaterThan(0)
})

test('External script has nonce attribute', async ({ page }) => {
  const { rawHtml } = await getRawHtml(page)
  expect(rawHtml).toMatch(
    /<script(?=[^>]*\bsrc="\/external\.js")(?=[^>]*\bnonce="[^"]+")[^>]*>/,
  )
})

test('External stylesheet has nonce attribute', async ({ page }) => {
  await page.goto('/')
  const externalStylesheet = page.locator('link[href="/external.css"]')
  await expect(externalStylesheet).toHaveAttribute('nonce')
})

test('Nonces match between header and elements', async ({ page }) => {
  // Intercept the HTML response to get raw content before browser strips nonces
  const { rawHtml, response } = await getRawHtml(page)

  const csp = response?.headers()['content-security-policy'] || ''

  // Extract nonce from CSP header
  const nonceMatch = csp.match(/nonce-([a-f0-9]+)/)
  expect(nonceMatch).toBeTruthy()
  const headerNonce = nonceMatch![1]

  // Check script nonces match - look for nonce attribute anywhere in the script tag
  const scriptNonces = [
    ...rawHtml.matchAll(/<script[^>]*\bnonce="([^"]+)"[^>]*>/g),
  ].map((m) => m[1])
  expect(scriptNonces.length).toBeGreaterThan(0)
  for (const nonce of scriptNonces) {
    expect(nonce).toBe(headerNonce)
  }

  // Check style nonces match
  const styleNonces = [
    ...rawHtml.matchAll(/<style[^>]*\bnonce="([^"]+)"[^>]*>/g),
  ].map((m) => m[1])
  expect(styleNonces.length).toBeGreaterThan(0)
  for (const nonce of styleNonces) {
    expect(nonce).toBe(headerNonce)
  }

  // Check external script nonce matches (nonce can be before or after src)
  const externalScriptMatch = rawHtml.match(
    /<script[^>]*\bsrc="\/external\.js"[^>]*\bnonce="([^"]+)"[^>]*>|<script[^>]*\bnonce="([^"]+)"[^>]*\bsrc="\/external\.js"[^>]*>/,
  )
  expect(externalScriptMatch).toBeTruthy()
  expect(externalScriptMatch![1] || externalScriptMatch![2]).toBe(headerNonce)

  // Check external stylesheet nonce matches (nonce can be before or after href)
  const externalStyleMatch = rawHtml.match(
    /<link[^>]*\bhref="\/external\.css"[^>]*\bnonce="([^"]+)"[^>]*>|<link[^>]*\bnonce="([^"]+)"[^>]*\bhref="\/external\.css"[^>]*>/,
  )
  expect(externalStyleMatch).toBeTruthy()
  expect(externalStyleMatch![1] || externalStyleMatch![2]).toBe(headerNonce)
})

test('Hydration works - counter increments', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('counter-value')).toContainText('0')

  // Keep clicking until React hydrates and the counter increments
  // This handles the race between test execution and hydration
  await expect
    .poll(
      async () => {
        await page.getByTestId('counter-btn').click()
        return page.getByTestId('counter-value').textContent()
      },
      { timeout: 10000, intervals: [100, 200, 500, 1000] },
    )
    .not.toBe('0')

  // Now that hydration is confirmed, verify further increments work
  const currentValue = parseInt(
    (await page.getByTestId('counter-value').textContent()) || '0',
  )
  await page.getByTestId('counter-btn').click()
  await expect(page.getByTestId('counter-value')).toContainText(
    String(currentValue + 1),
  )
})

test('Inline styles work with CSP', async ({ page }) => {
  await page.goto('/')
  const el = page.getByTestId('inline-styled')
  await expect(el).toBeVisible()
  // Verify the style was applied (green color)
  const color = await el.evaluate((e) => getComputedStyle(e).color)
  expect(color).toBe('rgb(0, 128, 0)') // green
})

test('External styles work with CSP', async ({ page }) => {
  await page.goto('/')
  const el = page.getByTestId('external-styled')
  await expect(el).toBeVisible()
  // Verify the style was applied (blue color)
  const color = await el.evaluate((e) => getComputedStyle(e).color)
  expect(color).toBe('rgb(0, 0, 255)') // blue
})

test('External script executes with CSP', async ({ page }) => {
  await page.goto('/')
  // Check that the external script set its window global
  await expect
    .poll(() => page.evaluate(() => (window as any).__EXTERNAL_SCRIPT_LOADED__))
    .toBe(true)
})

test('No CSP violations in console', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (msg) => {
    if (msg.text().toLowerCase().includes('content security policy')) {
      violations.push(msg.text())
    }
  })
  page.on('pageerror', (err) => {
    if (err.message.toLowerCase().includes('content security policy')) {
      violations.push(err.message)
    }
  })
  await page.goto('/')
  await page.getByTestId('counter-btn').click()
  // Small wait to ensure any async violations are caught
  await page.waitForTimeout(100)
  expect(violations).toEqual([])
})

test('Each request gets a unique nonce', async ({ page }) => {
  const response1 = await page.goto('/')
  const csp1 = response1?.headers()['content-security-policy'] || ''
  const nonce1 = csp1.match(/nonce-([a-f0-9]+)/)?.[1]

  const response2 = await page.goto('/')
  const csp2 = response2?.headers()['content-security-policy'] || ''
  const nonce2 = csp2.match(/nonce-([a-f0-9]+)/)?.[1]

  expect(nonce1).toBeTruthy()
  expect(nonce2).toBeTruthy()
  expect(nonce1).not.toBe(nonce2)
})
