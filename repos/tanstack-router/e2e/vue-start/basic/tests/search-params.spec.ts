import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { isSpaMode } from './utils/isSpaMode'
import { isPrerender } from './utils/isPrerender'
import type { Response } from '@playwright/test'

function expectRedirect(response: Response | null, endsWith: string) {
  expect(response).not.toBeNull()
  expect(response!.request().redirectedFrom()).not.toBeNull()
  const redirectUrl = response!
    .request()
    .redirectedFrom()!
    .redirectedTo()
    ?.url()
  expect(redirectUrl).toBeDefined()
  expect(redirectUrl!.endsWith(endsWith))
}

function expectNoRedirect(response: Response | null) {
  expect(response).not.toBeNull()
  const request = response!.request()
  expect(request.redirectedFrom()).toBeNull()
}

test.describe('/search-params/loader-throws-redirect', () => {
  test('Directly visiting the route without search param set', async ({
    page,
  }) => {
    const response = await page.goto('/search-params/loader-throws-redirect')

    if (!isSpaMode && !isPrerender) {
      expectRedirect(response, '/search-params/loader-throws-redirect?step=a')
    }

    await expect(page.getByTestId('search-param')).toContainText('a')
    expect(page.url().endsWith('/search-params/loader-throws-redirect?step=a'))
  })

  test('Directly visiting the route with search param set', async ({
    page,
  }) => {
    const response = await page.goto(
      '/search-params/loader-throws-redirect?step=b',
    )
    expectNoRedirect(response)
    await expect(page.getByTestId('search-param')).toContainText('b')
    expect(page.url().endsWith('/search-params/loader-throws-redirect?step=b'))
  })
})

test.describe('/search-params/default', () => {
  test('Directly visiting the route without search param set', async ({
    page,
  }) => {
    const response = await page.goto('/search-params/default')
    if (!isSpaMode && !isPrerender) {
      expectRedirect(response, '/search-params/default?default=d1')
    }
    await expect(page.getByTestId('search-default')).toContainText('d1')
    await expect(page.getByTestId('context-hello')).toContainText('world')
    expect(
      page.url().endsWith('/search-params/default?default=d1'),
    ).toBeTruthy()
  })

  test('Directly visiting the route with search param set', async ({
    page,
  }) => {
    const response = await page.goto('/search-params/default?default=d2')
    expectNoRedirect(response)

    await expect(page.getByTestId('search-default')).toContainText('d2')
    await expect(page.getByTestId('context-hello')).toContainText('world')
    expect(
      page.url().endsWith('/search-params/default?default=d2'),
    ).toBeTruthy()
  })

  test('navigating to the route without search param set', async ({ page }) => {
    await page.goto('/search-params/')
    await page.getByTestId('link-to-default-without-search').click()

    await expect(page.getByTestId('search-default')).toContainText('d1')
    await expect(page.getByTestId('context-hello')).toContainText('world')
    expect(
      page.url().endsWith('/search-params/default?default=d1'),
    ).toBeTruthy()
  })

  test('navigating to the route with search param set', async ({ page }) => {
    await page.goto('/search-params/')
    await page.getByTestId('link-to-default-with-search').click()

    await expect(page.getByTestId('search-default')).toContainText('d2')
    await expect(page.getByTestId('context-hello')).toContainText('world')
    expect(
      page.url().endsWith('/search-params/default?default=d2'),
    ).toBeTruthy()
  })
})
