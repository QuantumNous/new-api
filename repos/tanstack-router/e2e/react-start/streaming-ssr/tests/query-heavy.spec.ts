import { expect, test, testWithHydration } from './fixtures'

test.describe('Query heavy route (9 useSuspenseQuery)', () => {
  test('all queries resolve with server data', async ({ page }) => {
    await page.goto('/query-heavy')

    // Sync queries should show server source
    await expect(page.getByTestId('sync-query-1')).toContainText(
      'source: server',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('sync-query-2')).toContainText(
      'source: server',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('sync-query-3')).toContainText(
      'source: server',
      { timeout: 5000 },
    )

    // Fast async queries should show server source
    await expect(page.getByTestId('fast-async-query-1')).toContainText(
      'source: server',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('fast-async-query-2')).toContainText(
      'source: server',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('fast-async-query-3')).toContainText(
      'source: server',
      { timeout: 5000 },
    )

    // Slow async queries should show server source
    await expect(page.getByTestId('slow-async-query-1')).toContainText(
      'source: server',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('slow-async-query-2')).toContainText(
      'source: server',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('slow-async-query-3')).toContainText(
      'source: server',
      { timeout: 5000 },
    )
  })

  test('sync queries have correct values', async ({ page }) => {
    await page.goto('/query-heavy')

    await expect(page.getByTestId('sync-query-1')).toContainText('sync-value-1')
    await expect(page.getByTestId('sync-query-2')).toContainText('sync-value-2')
    await expect(page.getByTestId('sync-query-3')).toContainText('sync-value-3')
  })

  test('async queries have correct values', async ({ page }) => {
    await page.goto('/query-heavy')

    await expect(page.getByTestId('fast-async-query-1')).toContainText(
      'fast-async-1',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('fast-async-query-2')).toContainText(
      'fast-async-2',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('fast-async-query-3')).toContainText(
      'fast-async-3',
      { timeout: 5000 },
    )

    await expect(page.getByTestId('slow-async-query-1')).toContainText(
      'slow-async-1',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('slow-async-query-2')).toContainText(
      'slow-async-2',
      { timeout: 5000 },
    )
    await expect(page.getByTestId('slow-async-query-3')).toContainText(
      'slow-async-3',
      { timeout: 5000 },
    )
  })

  testWithHydration('hydration works with many queries', async ({ page }) => {
    await page.goto('/query-heavy')
    await page.waitForLoadState('networkidle')

    // Wait for all queries to resolve
    await expect(page.getByTestId('slow-async-query-3')).toBeVisible({
      timeout: 5000,
    })
  })

  test('client-side navigation works', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Navigate via nav link
    await page.getByRole('link', { name: 'Query Heavy' }).click()
    await expect(page).toHaveURL('/query-heavy')

    // All queries should eventually resolve (on client)
    await expect(page.getByTestId('slow-async-query-3')).toBeVisible({
      timeout: 5000,
    })
  })

  test('no hydration mismatch - queries streamed from server', async ({
    page,
  }) => {
    // This test verifies that query data is streamed from server
    // If it wasn't, the queries would re-execute on client and show 'client' as source
    await page.goto('/query-heavy')

    // Wait for all queries
    await expect(page.getByTestId('slow-async-query-3')).toBeVisible({
      timeout: 5000,
    })

    // Verify all show 'server' - this proves data was streamed, not re-fetched
    const serverSourceCount = await page
      .locator('[data-testid*="query-"]')
      .filter({ hasText: 'source: server' })
      .count()
    expect(serverSourceCount).toBe(9)
  })

  test('emits query stream data before stream end marker', async ({
    request,
  }) => {
    const response = await request.get('/query-heavy')
    const html = await response.text()
    const endMarker = '$_TSR.e()'
    const endIndex = html.indexOf(endMarker)
    const slowAsyncPayloadIndex = html.indexOf('"slow-async-3"')
    const lastScriptOpen = html.lastIndexOf('<script', endIndex)
    const lastScriptClose = html.lastIndexOf('</script>', endIndex)

    expect(endIndex).toBeGreaterThan(-1)
    expect(lastScriptOpen).toBeGreaterThan(lastScriptClose)
    expect(slowAsyncPayloadIndex).toBeGreaterThan(-1)
    expect(slowAsyncPayloadIndex).toBeLessThan(endIndex)
    expect(html.slice(lastScriptOpen, endIndex)).toContain('.return(void 0)')
    expect(endIndex).toBeLessThan(html.indexOf('</body>'))
  })
})
