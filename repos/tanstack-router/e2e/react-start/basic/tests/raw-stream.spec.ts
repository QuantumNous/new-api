import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { isPrerender } from './utils/isPrerender'

/**
 * These tests verify the RawStream binary streaming functionality.
 *
 * RawStream allows returning ReadableStream<Uint8Array> from server functions
 * with efficient binary encoding:
 * - Server functions (RPC): Binary framing protocol
 * - SSR loaders: Base64 encoding via seroval's stream mechanism
 */

// Wait time for hydration to complete after page load
// This needs to be long enough for React hydration to attach event handlers
const HYDRATION_WAIT = 1000

test.describe('RawStream - Client RPC Tests', () => {
  test('Single raw stream - returns stream with binary data', async ({
    page,
  }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    // Wait for hydration
    await page.getByTestId('test1-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test1-btn').click()
    await page
      .getByTestId('test1-result')
      .waitFor({ state: 'visible', timeout: 10000 })

    const result = await page.getByTestId('test1-result').textContent()

    expect(result).toContain('chunk1chunk2chunk3')
    expect(result).toContain('Single stream test')
  })

  test('Multiple raw streams - returns multiple independent streams', async ({
    page,
  }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test2-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test2-btn').click()
    await page
      .getByTestId('test2-result')
      .waitFor({ state: 'visible', timeout: 10000 })

    const result = await page.getByTestId('test2-result').textContent()

    expect(result).toContain('stream1-astream1-b')
    expect(result).toContain('stream2-astream2-b')
    expect(result).toContain('Multiple streams test')
  })

  test('JSON ends before raw stream - handles timing correctly', async ({
    page,
  }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test3-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test3-btn').click()
    await page
      .getByTestId('test3-result')
      .waitFor({ state: 'visible', timeout: 10000 })
    const result = await page.getByTestId('test3-result').textContent()

    expect(result).toContain('slow-1slow-2slow-3slow-4')
    expect(result).toContain('JSON ends first test')
    expect(result).toContain('hasTimestamp')
  })

  test('Raw stream ends before JSON - handles timing correctly', async ({
    page,
  }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test4-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test4-btn').click()
    await page
      .getByTestId('test4-result')
      .waitFor({ state: 'visible', timeout: 10000 })
    const result = await page.getByTestId('test4-result').textContent()

    expect(result).toContain('fast-done')
    expect(result).toContain('deferred-json-data')
    expect(result).toContain('Raw ends first test')
  })

  test('Large binary data - handles 3KB of binary correctly', async ({
    page,
  }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test5-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test5-btn').click()
    await page
      .getByTestId('test5-result')
      .waitFor({ state: 'visible', timeout: 10000 })
    const result = await page.getByTestId('test5-result').textContent()

    expect(result).toContain('"sizeMatch":true')
    expect(result).toContain('"actualSize":3072')
    expect(result).toContain('Large binary test')
  })

  test('Mixed streaming - Promise and RawStream together', async ({ page }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test6-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test6-btn').click()
    await page
      .getByTestId('test6-result')
      .waitFor({ state: 'visible', timeout: 10000 })
    const result = await page.getByTestId('test6-result').textContent()

    expect(result).toContain('immediate-value')
    expect(result).toContain('deferred-value')
    expect(result).toContain('mixed-raw-1mixed-raw-2')
  })
})

test.describe('RawStream - SSR Loader Tests', () => {
  test('SSR single stream - direct navigation', async ({ page }) => {
    // Direct navigation = full SSR with base64 encoding
    await page.goto('/raw-stream/ssr-single')
    await page.waitForURL('/raw-stream/ssr-single')

    // Wait for stream to be consumed (SSR tests need hydration + stream consumption)
    await expect(page.getByTestId('ssr-single-stream')).toContainText(
      'ssr-chunk1ssr-chunk2ssr-chunk3',
      { timeout: 10000 },
    )
    await expect(page.getByTestId('ssr-single-message')).toContainText(
      'SSR Single Stream Test',
    )
    await expect(page.getByTestId('ssr-single-timestamp')).toContainText(
      'Has Timestamp: true',
    )
  })

  test('SSR multiple streams - direct navigation', async ({ page }) => {
    await page.goto('/raw-stream/ssr-multiple')
    await page.waitForURL('/raw-stream/ssr-multiple')

    await expect(page.getByTestId('ssr-multiple-first')).toContainText(
      'multi-1amulti-1b',
      { timeout: 10000 },
    )
    await expect(page.getByTestId('ssr-multiple-second')).toContainText(
      'multi-2amulti-2b',
    )
    await expect(page.getByTestId('ssr-multiple-message')).toContainText(
      'SSR Multiple Streams Test',
    )
  })

  // Skip in prerender mode: RawStream + deferred data causes stream chunks to be
  // missing from prerendered HTML. This is a known limitation where the prerender
  // process doesn't properly capture streaming data when deferred promises are present.
  ;(isPrerender ? test.skip : test)(
    'SSR mixed streaming - RawStream with deferred data',
    async ({ page }) => {
      await page.goto('/raw-stream/ssr-mixed')
      await page.waitForURL('/raw-stream/ssr-mixed')

      await expect(page.getByTestId('ssr-mixed-immediate')).toContainText(
        'immediate-ssr-value',
      )
      await expect(page.getByTestId('ssr-mixed-stream')).toContainText(
        'mixed-ssr-1mixed-ssr-2',
        { timeout: 10000 },
      )
      // Deferred promise should also resolve
      await expect(page.getByTestId('ssr-mixed-deferred')).toContainText(
        'deferred-ssr-value',
        { timeout: 10000 },
      )
    },
  )

  test('SSR single stream - client-side navigation', async ({ page }) => {
    // Start from index, then navigate client-side to SSR route
    await page.goto('/raw-stream')
    await page.waitForURL('/raw-stream')

    // Wait for hydration (use navigation to be specific)
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'SSR Single' })
      .waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    // Client-side navigation
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'SSR Single' })
      .click()
    await page.waitForURL('/raw-stream/ssr-single')

    // Stream should still work after client navigation
    await expect(page.getByTestId('ssr-single-stream')).toContainText(
      'ssr-chunk1ssr-chunk2ssr-chunk3',
      { timeout: 10000 },
    )
  })

  test('SSR multiple streams - client-side navigation', async ({ page }) => {
    await page.goto('/raw-stream')
    await page.waitForURL('/raw-stream')

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'SSR Multiple' })
      .waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'SSR Multiple' })
      .click()
    await page.waitForURL('/raw-stream/ssr-multiple')

    await expect(page.getByTestId('ssr-multiple-first')).toContainText(
      'multi-1amulti-1b',
      { timeout: 10000 },
    )
    await expect(page.getByTestId('ssr-multiple-second')).toContainText(
      'multi-2amulti-2b',
    )
  })
})

test.describe('RawStream - Hint Parameter (RPC)', () => {
  test('Text hint with pure text - uses UTF-8 encoding', async ({ page }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test7-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test7-btn').click()
    await page
      .getByTestId('test7-result')
      .waitFor({ state: 'visible', timeout: 10000 })
    const result = await page.getByTestId('test7-result').textContent()

    expect(result).toContain('"match":true')
    expect(result).toContain('Hello, World! This is text.')
    expect(result).toContain('Text hint with pure text')
  })

  test('Text hint with pure binary - fallback to base64', async ({ page }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test8-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test8-btn').click()
    await page
      .getByTestId('test8-result')
      .waitFor({ state: 'visible', timeout: 10000 })
    const result = await page.getByTestId('test8-result').textContent()

    expect(result).toContain('"match":true')
    expect(result).toContain('"expectedLength":12')
  })

  test('Text hint with mixed content - handles both', async ({ page }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test9-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test9-btn').click()
    await page
      .getByTestId('test9-result')
      .waitFor({ state: 'visible', timeout: 10000 })
    const result = await page.getByTestId('test9-result').textContent()

    expect(result).toContain('"match":true')
    expect(result).toContain('"expectedLength":30')
  })

  test('Binary hint with text data - uses base64', async ({ page }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test10-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test10-btn').click()
    await page
      .getByTestId('test10-result')
      .waitFor({ state: 'visible', timeout: 10000 })
    const result = await page.getByTestId('test10-result').textContent()

    expect(result).toContain('"match":true')
    expect(result).toContain('This is text but using binary hint')
  })

  test('Binary hint with binary data - uses base64', async ({ page }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test11-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test11-btn').click()
    await page
      .getByTestId('test11-result')
      .waitFor({ state: 'visible', timeout: 10000 })
    const result = await page.getByTestId('test11-result').textContent()

    expect(result).toContain('"match":true')
    expect(result).toContain('"expectedLength":6')
  })
})

test.describe('RawStream - SSR Hint Parameter Tests', () => {
  test('SSR text hint with pure text - direct navigation', async ({ page }) => {
    await page.goto('/raw-stream/ssr-text-hint')
    await page.waitForURL('/raw-stream/ssr-text-hint')

    await expect(page.getByTestId('ssr-text-hint-pure-text')).toContainText(
      'Hello World from SSR!',
      { timeout: 10000 },
    )
    await expect(page.getByTestId('ssr-text-hint-pure-match')).toContainText(
      'true',
    )
    await expect(page.getByTestId('ssr-text-hint-mixed-match')).toContainText(
      'true',
    )
    await expect(
      page.getByTestId('ssr-text-hint-pure-binary-match'),
    ).toContainText('true')
  })

  test('SSR text hint - byte-by-byte verification', async ({ page }) => {
    await page.goto('/raw-stream/ssr-text-hint')
    await page.waitForURL('/raw-stream/ssr-text-hint')

    // Wait for streams to be fully consumed
    await expect(page.getByTestId('ssr-text-hint-result')).toContainText(
      '"match":true',
      { timeout: 10000 },
    )
    // Check pure text, mixed content, and pure binary all match
    const result = await page.getByTestId('ssr-text-hint-result').textContent()
    const parsed = JSON.parse(result || '{}')
    expect(parsed.pureTextMatch?.match).toBe(true)
    expect(parsed.mixedMatch?.match).toBe(true)
    expect(parsed.pureBinaryMatch?.match).toBe(true)
  })

  test('SSR binary hint with text - direct navigation', async ({ page }) => {
    await page.goto('/raw-stream/ssr-binary-hint')
    await page.waitForURL('/raw-stream/ssr-binary-hint')

    await expect(page.getByTestId('ssr-binary-hint-text')).toContainText(
      'Binary hint with text',
      { timeout: 10000 },
    )
    await expect(page.getByTestId('ssr-binary-hint-text-match')).toContainText(
      'true',
    )
    await expect(
      page.getByTestId('ssr-binary-hint-binary-match'),
    ).toContainText('true')
  })

  test('SSR binary hint - byte-by-byte verification', async ({ page }) => {
    await page.goto('/raw-stream/ssr-binary-hint')
    await page.waitForURL('/raw-stream/ssr-binary-hint')

    // Wait for streams to be fully consumed
    await expect(page.getByTestId('ssr-binary-hint-result')).toContainText(
      '"match":true',
      { timeout: 10000 },
    )
    // Check both text and binary data match
    const result = await page
      .getByTestId('ssr-binary-hint-result')
      .textContent()
    const parsed = JSON.parse(result || '{}')
    expect(parsed.textMatch?.match).toBe(true)
    expect(parsed.binaryMatch?.match).toBe(true)
  })

  test('SSR text hint - client-side navigation', async ({ page }) => {
    await page.goto('/raw-stream')
    await page.waitForURL('/raw-stream')

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'SSR Text Hint' })
      .waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'SSR Text Hint' })
      .click()
    await page.waitForURL('/raw-stream/ssr-text-hint')

    await expect(page.getByTestId('ssr-text-hint-pure-match')).toContainText(
      'true',
      { timeout: 10000 },
    )
    await expect(page.getByTestId('ssr-text-hint-mixed-match')).toContainText(
      'true',
    )
    await expect(
      page.getByTestId('ssr-text-hint-pure-binary-match'),
    ).toContainText('true')
  })

  test('SSR binary hint - client-side navigation', async ({ page }) => {
    await page.goto('/raw-stream')
    await page.waitForURL('/raw-stream')

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'SSR Binary Hint' })
      .waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'SSR Binary Hint' })
      .click()
    await page.waitForURL('/raw-stream/ssr-binary-hint')

    await expect(page.getByTestId('ssr-binary-hint-text-match')).toContainText(
      'true',
      { timeout: 10000 },
    )
    await expect(
      page.getByTestId('ssr-binary-hint-binary-match'),
    ).toContainText('true')
  })
})

test.describe('RawStream - Multiplexing Tests (RPC)', () => {
  test('Interleaved streams - two concurrent streams with variable delays', async ({
    page,
  }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test12-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test12-btn').click()
    await page
      .getByTestId('test12-result')
      .waitFor({ state: 'visible', timeout: 15000 })
    const result = await page.getByTestId('test12-result').textContent()

    // Both streams should have matching bytes
    expect(result).toContain('"match":true')
    // Verify both streams match
    const parsed = JSON.parse(result || '{}')
    expect(parsed.streamA?.match).toBe(true)
    expect(parsed.streamB?.match).toBe(true)
  })

  test('Burst-pause-burst - single stream with variable timing', async ({
    page,
  }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test13-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test13-btn').click()
    await page
      .getByTestId('test13-result')
      .waitFor({ state: 'visible', timeout: 15000 })
    const result = await page.getByTestId('test13-result').textContent()

    expect(result).toContain('"match":true')
    expect(result).toContain('Burst-pause-burst test')
  })

  test('Three concurrent streams - different timing patterns', async ({
    page,
  }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test14-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test14-btn').click()
    await page
      .getByTestId('test14-result')
      .waitFor({ state: 'visible', timeout: 15000 })
    const result = await page.getByTestId('test14-result').textContent()

    // All three streams should match
    expect(result).toContain('"match":true')
    // Verify all three streams match
    const parsed = JSON.parse(result || '{}')
    expect(parsed.fast?.match).toBe(true)
    expect(parsed.slow?.match).toBe(true)
    expect(parsed.burst?.match).toBe(true)
  })
})

test.describe('RawStream - Cross Navigation', () => {
  test('Client RPC works after navigating from SSR route', async ({ page }) => {
    // Start with SSR route
    await page.goto('/raw-stream/ssr-single')
    await page.waitForURL('/raw-stream/ssr-single')

    // Wait for SSR stream to complete (ensures hydration is done)
    await expect(page.getByTestId('ssr-single-stream')).toContainText(
      'ssr-chunk1ssr-chunk2ssr-chunk3',
      { timeout: 10000 },
    )

    // Navigate to client-call route (use first() to avoid strict mode on multiple matches)
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Client Calls' })
      .click()
    await page.waitForURL('/raw-stream/client-call')

    // Wait for hydration
    await page.getByTestId('test1-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    // Run RPC test
    await page.getByTestId('test1-btn').click()

    await expect(page.getByTestId('test1-result')).toContainText(
      'chunk1chunk2chunk3',
      { timeout: 10000 },
    )
  })

  test('Navigation from home to raw-stream routes', async ({ page }) => {
    // Start from home
    await page.goto('/')
    await page.waitForURL('/')

    // Wait for hydration
    await page
      .getByRole('link', { name: 'Raw Stream' })
      .waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    // Navigate via client-side to raw-stream
    await page.getByRole('link', { name: 'Raw Stream' }).click()
    await page.waitForURL('/raw-stream')

    // Wait for hydration on the new page
    await page.waitForTimeout(HYDRATION_WAIT)

    // Then to client-call (use navigation area to avoid duplicates)
    await page
      .getByRole('navigation')
      .getByRole('link', { name: 'Client Calls' })
      .click()
    await page.waitForURL('/raw-stream/client-call')

    // Wait for button
    await page.getByTestId('test1-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    // Run a test
    await page.getByTestId('test1-btn').click()

    await expect(page.getByTestId('test1-result')).toContainText(
      'chunk1chunk2chunk3',
      { timeout: 10000 },
    )
  })
})

test.describe('RawStream - Edge Cases (RPC)', () => {
  test('Empty stream - handles zero-byte stream correctly', async ({
    page,
  }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test15-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test15-btn').click()

    await page
      .getByTestId('test15-result')
      .waitFor({ state: 'visible', timeout: 10000 })

    const result = await page.getByTestId('test15-result').textContent()
    expect(result).toContain('"isEmpty":true')
    expect(result).toContain('"byteCount":0')
    expect(result).toContain('Empty stream test')
  })

  test('Stream error - propagates error to client', async ({ page }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test16-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test16-btn').click()

    await page
      .getByTestId('test16-result')
      .waitFor({ state: 'visible', timeout: 10000 })

    const result = await page.getByTestId('test16-result').textContent()

    expect(result).toContain('"errorCaught":true')
    expect(result).toContain('Intentional stream error')
    expect(result).toContain('Error stream test')
  })
})

test.describe('RawStream - Late RawStream Tests (RPC)', () => {
  test('Single late RawStream - Promise<RawStream> resolves correctly', async ({
    page,
  }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test17-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test17-btn').click()

    await expect(page.getByTestId('test17-result')).toContainText(
      '"match":true',
      { timeout: 15000 },
    )
    await expect(page.getByTestId('test17-result')).toContainText(
      'Late stream test',
    )
  })

  test('Multiple late RawStreams - different Promise delays', async ({
    page,
  }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test18-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test18-btn').click()

    // Both streams should match
    await expect(page.getByTestId('test18-result')).toContainText(
      '"match":true',
      { timeout: 15000 },
    )
    // Verify both streams match by checking result
    const result = await page.getByTestId('test18-result').textContent()
    const parsed = JSON.parse(result || '{}')
    expect(parsed.streamA?.match).toBe(true)
    expect(parsed.streamB?.match).toBe(true)
    expect(parsed.message).toBe('Multiple late streams test')
  })

  test('Mixed immediate and late RawStreams - both work correctly', async ({
    page,
  }) => {
    await page.goto('/raw-stream/client-call')
    await page.waitForURL('/raw-stream/client-call')

    await page.getByTestId('test19-btn').waitFor({ state: 'visible' })
    await page.waitForTimeout(HYDRATION_WAIT)

    await page.getByTestId('test19-btn').click()

    // Both immediate and late streams should match
    await expect(page.getByTestId('test19-result')).toContainText(
      '"match":true',
      { timeout: 15000 },
    )
    // Verify both streams match by checking result
    const result = await page.getByTestId('test19-result').textContent()
    const parsed = JSON.parse(result || '{}')
    expect(parsed.immediate?.match).toBe(true)
    expect(parsed.late?.match).toBe(true)
    expect(parsed.message).toBe('Mixed immediate and late test')
  })
})
