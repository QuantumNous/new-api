import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

// if the query would not be streamed to the client, it would re-execute on the client
// and thus cause a hydration mismatch since the query function returns 'client' when executed on the client
test.describe('queries are streamed from the server', () => {
  test('direct visit - loader on server runs fetchQuery and awaits it', async ({
    page,
  }) => {
    await page.goto('/loader-fetchQuery/sync')

    // wait for the query data to be streamed from the server
    const queryData = page.getByTestId('query-data')
    await expect(queryData).toHaveText('server')

    // the loader data should be the same as the query data
    const loaderData = page.getByTestId('loader-data')
    await expect(loaderData).toHaveText('server')
  })
  test('direct visit - loader on server runs fetchQuery and does not await it', async ({
    page,
  }) => {
    await page.goto('/loader-fetchQuery/async')

    // wait for the query data to be streamed from the server
    const queryData = page.getByTestId('query-data')
    await expect(queryData).toHaveText('server')

    const loaderData = page.getByTestId('loader-data')
    await expect(loaderData).toHaveText('undefined')
  })

  test('useSuspenseQuery', async ({ page }) => {
    await page.goto('/useSuspenseQuery')

    const queryData = page.getByTestId('query-data')
    await expect(queryData).toHaveText('server')
  })
})

test('useQuery does not execute on the server and therefore does not stream data to the client', async ({
  page,
}) => {
  await page.goto('/useQuery')

  const queryData = page.getByTestId('query-data')
  await expect(queryData).toHaveText('client')
})
