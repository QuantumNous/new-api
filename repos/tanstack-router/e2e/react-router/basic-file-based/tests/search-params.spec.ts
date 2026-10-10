import { expect, test } from '@playwright/test'

test.describe('/search-params/default', () => {
  test('Directly visiting the route without search param set', async ({
    page,
  }) => {
    await page.goto('/search-params/default')
    await page.waitForURL('/search-params/default?default=d1')

    await expect(page.getByTestId('search-default')).toContainText('d1')
    await expect(page.getByTestId('context-hello')).toContainText('world')
    expect(
      page.url().endsWith('/search-params/default?default=d1'),
    ).toBeTruthy()
  })

  test('Directly visiting the route with search param set', async ({
    page,
  }) => {
    await page.goto('/search-params/default/?default=d2')
    await page.waitForURL('/search-params/default?default=d2')

    await expect(page.getByTestId('search-default')).toContainText('d2')
    await expect(page.getByTestId('context-hello')).toContainText('world')
    expect(
      page.url().endsWith('/search-params/default?default=d2'),
    ).toBeTruthy()
  })

  test('Directly visiting the route with special character search param set', async ({
    page,
  }) => {
    await page.goto('/search-params/default/?default=🚀대한민국')
    await page.waitForURL(
      '/search-params/default?default=%F0%9F%9A%80%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD',
    )

    await expect(page.getByTestId('search-default')).toContainText('🚀대한민국')
    await expect(page.getByTestId('context-hello')).toContainText('world')

    expect(
      page
        .url()
        .endsWith(
          '/search-params/default?default=%F0%9F%9A%80%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD',
        ),
    ).toBeTruthy()
  })

  test('Directly visiting the route with encoded character search param set', async ({
    page,
  }) => {
    await page.goto(
      '/search-params/default/?default=%25EB%258C%2580%25ED%2595%259C%25EB%25AF%25BC%25EA%25B5%25AD',
    )
    await page.waitForURL(
      '/search-params/default?default=%25EB%258C%2580%25ED%2595%259C%25EB%25AF%25BC%25EA%25B5%25AD',
    )

    await expect(page.getByTestId('search-default')).toContainText(
      '%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD',
    )
    await expect(page.getByTestId('context-hello')).toContainText('world')

    expect(
      page
        .url()
        .endsWith(
          '/search-params/default?default=%25EB%258C%2580%25ED%2595%259C%25EB%25AF%25BC%25EA%25B5%25AD',
        ),
    ).toBeTruthy()
  })

  test('navigating to the route without search param set', async ({ page }) => {
    await page.goto('/search-params/')
    await page.getByTestId('link-to-default-without-search').click()
    await page.waitForURL('/search-params/default?default=d1')

    await expect(page.getByTestId('search-default')).toContainText('d1')
    await expect(page.getByTestId('context-hello')).toContainText('world')
    expect(
      page.url().endsWith('/search-params/default?default=d1'),
    ).toBeTruthy()
  })

  test('navigating to the route with search param set', async ({ page }) => {
    await page.goto('/search-params/')
    await page.getByTestId('link-to-default-with-search').click()
    await page.waitForURL('/search-params/default?default=d2')

    await expect(page.getByTestId('search-default')).toContainText('d2')
    await expect(page.getByTestId('context-hello')).toContainText('world')
    expect(
      page.url().endsWith('/search-params/default?default=d2'),
    ).toBeTruthy()
  })

  test('navigating to the route with special character search param set', async ({
    page,
  }) => {
    await page.goto('/search-params/')
    await page
      .getByTestId('link-to-default-with-search-special-characters')
      .click()
    await page.waitForURL(
      '/search-params/default?default=%F0%9F%9A%80%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD',
    )

    await expect(page.getByTestId('search-default')).toContainText('🚀대한민국')
    await expect(page.getByTestId('context-hello')).toContainText('world')
    expect(
      page
        .url()
        .endsWith(
          '/search-params/default?default=%F0%9F%9A%80%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD',
        ),
    ).toBeTruthy()
  })

  test('navigating to the route with encoded character search param set', async ({
    page,
  }) => {
    await page.goto('/search-params/')
    await page
      .getByTestId('link-to-default-with-search-encoded-characters')
      .click()
    await page.waitForURL(
      '/search-params/default?default=%25EB%258C%2580%25ED%2595%259C%25EB%25AF%25BC%25EA%25B5%25AD',
    )

    await expect(page.getByTestId('search-default')).toContainText(
      '%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD',
    )
    await expect(page.getByTestId('context-hello')).toContainText('world')
    expect(
      page
        .url()
        .endsWith(
          '/search-params/default?default=%25EB%258C%2580%25ED%2595%259C%25EB%25AF%25BC%25EA%25B5%25AD',
        ),
    ).toBeTruthy()
  })
})
