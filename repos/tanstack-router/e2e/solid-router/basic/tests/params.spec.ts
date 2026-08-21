import { expect, test } from '@playwright/test'

test.describe('params operations + prefix/suffix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/params-ps')
  })

  test.describe('named params', () => {
    const NAMED_PARAMS_PAIRS = [
      // Test ID | Expected href
      {
        id: 'l-to-named-foo',
        pathname: '/params-ps/named/foo',
        params: { foo: 'foo' },
        destHeadingId: 'ParamsNamedFoo',
      },
      {
        id: 'l-to-named-prefixfoo',
        pathname: '/params-ps/named/prefixfoo',
        params: { foo: 'foo' },
        destHeadingId: 'ParamsNamedFooPrefix',
      },
      {
        id: 'l-to-named-foosuffix',
        pathname: '/params-ps/named/foosuffix',
        params: { foo: 'foo' },
        destHeadingId: 'ParamsNamedFooSuffix',
      },
    ] satisfies Array<{
      id: string
      pathname: string
      params: Record<string, string>
      destHeadingId: string
    }>

    test.describe('Link', () => {
      NAMED_PARAMS_PAIRS.forEach(({ id, pathname }) => {
        test(`interpolation for testid="${id}" has href="${pathname}"`, async ({
          page,
        }) => {
          const link = page.getByTestId(id)
          await expect(link).toHaveAttribute('href', pathname)
        })
      })

      NAMED_PARAMS_PAIRS.forEach(({ id, pathname }) => {
        test(`navigation for testid="${id}" succeeds to href="${pathname}"`, async ({
          page,
        }) => {
          const link = page.getByTestId(id)
          await link.click()
          await page.waitForLoadState('networkidle')
          const pagePathname = new URL(page.url()).pathname
          expect(pagePathname).toBe(pathname)
        })
      })
    })

    NAMED_PARAMS_PAIRS.forEach(({ pathname, params, destHeadingId }) => {
      test(`on first-load to "${pathname}" has correct params`, async ({
        page,
      }) => {
        await page.goto(pathname)
        await page.waitForLoadState('networkidle')
        const pagePathname = new URL(page.url()).pathname
        expect(pagePathname).toBe(pathname)

        const headingEl = page.getByRole('heading', { name: destHeadingId })
        await expect(headingEl).toBeVisible()

        const paramsEl = page.getByTestId('params-output')
        const paramsText = await paramsEl.innerText()
        const paramsObj = JSON.parse(paramsText)
        expect(paramsObj).toEqual(params)
      })
    })
  })

  test.describe('wildcard param', () => {
    const WILDCARD_PARAM_PAIRS = [
      // Test ID | Expected href
      {
        id: 'l-to-wildcard-foo',
        pathname: '/params-ps/wildcard/foo',
        params: { '*': 'foo', _splat: 'foo' },
        destHeadingId: 'ParamsWildcardSplat',
      },
      {
        id: 'l-to-wildcard-prefixfoo',
        pathname: '/params-ps/wildcard/prefixfoo',
        params: { '*': 'foo', _splat: 'foo' },
        destHeadingId: 'ParamsWildcardSplatPrefix',
      },
      {
        id: 'l-to-wildcard-foosuffix',
        pathname: '/params-ps/wildcard/foosuffix',
        params: { '*': 'foo', _splat: 'foo' },
        destHeadingId: 'ParamsWildcardSplatSuffix',
      },
    ] satisfies Array<{
      id: string
      pathname: string
      params: Record<string, string>
      destHeadingId: string
    }>

    test.describe('Link', () => {
      WILDCARD_PARAM_PAIRS.forEach(({ id, pathname }) => {
        test(`interpolation for testid="${id}" has href="${pathname}"`, async ({
          page,
        }) => {
          const link = page.getByTestId(id)
          await expect(link).toHaveAttribute('href', pathname)
        })
      })

      WILDCARD_PARAM_PAIRS.forEach(({ id, pathname }) => {
        test(`navigation for testid="${id}" succeeds to href="${pathname}"`, async ({
          page,
        }) => {
          const link = page.getByTestId(id)
          await link.click()
          await page.waitForLoadState('networkidle')
          const pagePathname = new URL(page.url()).pathname
          expect(pagePathname).toBe(pathname)
        })
      })
    })

    WILDCARD_PARAM_PAIRS.forEach(({ pathname, params, destHeadingId }) => {
      test(`on first-load to "${pathname}" has correct params`, async ({
        page,
      }) => {
        await page.goto(pathname)
        await page.waitForLoadState('networkidle')
        const pagePathname = new URL(page.url()).pathname
        expect(pagePathname).toBe(pathname)

        const headingEl = page.getByRole('heading', { name: destHeadingId })
        await expect(headingEl).toBeVisible()

        const paramsEl = page.getByTestId('params-output')
        const paramsText = await paramsEl.innerText()
        const paramsObj = JSON.parse(paramsText)
        expect(paramsObj).toEqual(params)
      })
    })
  })
})
