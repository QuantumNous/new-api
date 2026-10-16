import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { isSpaMode } from './utils/isSpaMode'

test.use({
  whitelistErrors: [
    /Failed to load resource: the server responded with a status of 404/,
  ],
})
test.describe('Unicode route rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/specialChars')
  })

  test('should render non-latin route correctly with direct navigation', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/specialChars/대한민국')
    await page.waitForURL(
      `${baseURL}/specialChars/%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD`,
    )

    await expect(page.getByTestId('special-non-latin-heading')).toBeInViewport()
  })

  test('should render non-latin route correctly during router navigation', async ({
    page,
    baseURL,
  }) => {
    const nonLatinLink = page.getByTestId('special-non-latin-link')

    await nonLatinLink.click()
    await page.waitForURL(
      `${baseURL}/specialChars/%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD`,
    )

    await expect(page.getByTestId('special-non-latin-heading')).toBeInViewport()
  })

  test.describe('Special characters in path params', () => {
    test('should render route correctly on direct navigation', async ({
      page,
      baseURL,
    }) => {
      await page.goto('/specialChars/대|')
      await page.waitForURL(`${baseURL}/specialChars/%EB%8C%80%7C`)

      const param = await page.getByTestId('special-param').textContent()

      expect(param).toBe('대|')
    })

    test('should render route correctly on router navigation', async ({
      page,
      baseURL,
    }) => {
      const link = page.getByTestId('special-param-link')

      await link.click()
      await page.waitForURL(`${baseURL}/specialChars/%EB%8C%80%7C`)

      const param = await page.getByTestId('special-param').textContent()

      expect(param).toBe('대|')
    })
  })

  test.describe('Special characters in search params', () => {
    test('should render route correctly on direct navigation', async ({
      page,
      baseURL,
    }) => {
      await page.goto('/specialChars/search?searchParam=대|')

      await page.waitForURL(
        `${baseURL}/specialChars/search?searchParam=%EB%8C%80|`,
      )

      const searchParam = await page
        .getByTestId('special-search-param')
        .textContent()

      expect(searchParam).toBe('대|')
    })

    test('should render route correctly on router navigation', async ({
      page,
      baseURL,
    }) => {
      const link = page.getByTestId('special-searchParam-link')

      await link.click()
      await page.waitForURL(
        `${baseURL}/specialChars/search?searchParam=%EB%8C%80%7C`,
      )

      const searchParam = await page
        .getByTestId('special-search-param')
        .textContent()

      expect(searchParam).toBe('대|')
    })
  })

  test.describe('Special characters in url hash', () => {
    test('should render route correctly on direct navigation', async ({
      page,
      baseURL,
    }) => {
      await expect(page.getByTestId('special-hash-link-1')).not.toContainClass(
        'font-bold',
      )
      await expect(page.getByTestId('special-hash-link-2')).not.toContainClass(
        'font-bold',
      )

      await page.goto('/specialChars/hash#대|')

      await page.waitForURL(`${baseURL}/specialChars/hash#%EB%8C%80|`)
      await page.waitForLoadState('load')

      await expect(page.getByTestId('special-hash-heading')).toBeInViewport()

      await expect(page.getByTestId('special-hash-link-1')).toContainClass(
        'font-bold',
      )

      await expect(page.getByTestId('special-hash-link-2')).not.toContainClass(
        'font-bold',
      )

      await page.getByTestId('toggle-hash-button').click()

      const hashValue = await page.getByTestId('special-hash').textContent()

      expect(hashValue).toBe('대|')
    })

    test('should render route correctly on router navigation', async ({
      page,
      baseURL,
    }) => {
      await expect(page.getByTestId('special-hash-link-1')).not.toContainClass(
        'font-bold',
      )

      await expect(page.getByTestId('special-hash-link-2')).not.toContainClass(
        'font-bold',
      )

      const link = page.getByTestId('special-hash-link-1')

      await link.click()

      await page.waitForURL(`${baseURL}/specialChars/hash#%EB%8C%80|`)
      await page.waitForLoadState('load')

      await expect(page.getByTestId('special-hash-heading')).toBeInViewport()

      await expect(page.getByTestId('special-hash-link-1')).toContainClass(
        'font-bold',
      )

      await expect(page.getByTestId('special-hash-link-2')).not.toContainClass(
        'font-bold',
      )

      await page.getByTestId('toggle-hash-button').click()

      const hashValue = await page.getByTestId('special-hash').textContent()

      expect(hashValue).toBe('대|')
    })
  })

  test.describe('malformed paths', () => {
    const malformedPathnames = [
      '/specialChars/malformed/%E0%A4',
      '/specialChars/malformed/%80',
      '/specialChars/malformed/%FF',
    ]

    test.use({
      whitelistErrors: [
        'Failed to load resource: the server responded with a status of 404',
        'Failed to load resource: the server responded with a status of 400 (Bad Request)',
      ],
    })

    for (const pathname of malformedPathnames) {
      test(`un-matched malformed path "${pathname}" should return bad request on direct navigation`, async ({
        page,
      }) => {
        const res = await page.goto(pathname)

        await page.waitForLoadState(`load`)

        // in spa mode this is caught and handled at server level
        if (!isSpaMode) {
          expect(res!.status()).toBe(400)
        } else {
          expect(res!.status()).toBe(400)
        }
      })
    }

    test('malformed path params should return not found on router link', async ({
      page,
      baseURL,
    }) => {
      await page.goto('/specialChars/malformed')
      await page.waitForURL(`${baseURL}/specialChars/malformed`)

      const link = page.getByTestId('special-malformed-path-link')

      await link.click()
      await page.waitForLoadState('load')

      await expect(
        page.getByTestId('default-not-found-component'),
      ).toBeInViewport()
    })

    test('un-matched malformed paths should return not found on direct navigation in search params', async ({
      page,
      baseURL,
    }) => {
      await page.goto('/specialChars/malformed/search?searchParam=%E0%A4')

      await page.waitForURL(
        `${baseURL}/specialChars/malformed/search?searchParam=%E0%A4`,
      )

      await expect(
        page.getByTestId('special-malformed-search-param'),
      ).toBeInViewport()

      const searchParam = await page
        .getByTestId('special-malformed-search-param')
        .textContent()

      expect(searchParam).toBe('�')
    })
  })
})
