import { expect, test } from '@playwright/test'
import combinateImport from 'combinate'
import { getTestServerPort } from '@tanstack/router-e2e-utils'
import packageJson from '../package.json' with { type: 'json' }

// somehow playwright does not correctly import default exports
const combinate = (combinateImport as any).default as typeof combinateImport

const PORT = await getTestServerPort(packageJson.name)

test.describe('relative_routing', () => {
  const internalNavigationTestMatrix = combinate({
    navigation: ['link', 'useNavigate'] as const,
  })

  internalNavigationTestMatrix.forEach(({ navigation }) => {
    test(`simple relative navigation. navigation: ${navigation}`, async ({
      page,
    }) => {
      await page.waitForLoadState('networkidle')
      await page.goto(`/relative/${navigation}`)
      await page.waitForURL(`http://localhost:${PORT}/relative/${navigation}`)

      await expect(
        page.getByTestId(`relative-${navigation}-header`),
      ).toBeInViewport()

      const indexLink = page.getByTestId(`relative-${navigation}-index`)
      const backLink = page.getByTestId(`relative-${navigation}-back`)
      const relativeRouteA = page.getByTestId(`relative-${navigation}-a`)
      const relativeRouteB = page.getByTestId(`relative-${navigation}-b`)

      await relativeRouteA.click()

      await page.waitForURL(
        `http://localhost:${PORT}/relative/${navigation}/relative-${navigation}-a`,
      )

      await expect(
        page.getByTestId(`relative-${navigation}-header`),
      ).toBeInViewport()

      await expect(
        page.getByTestId(`relative-${navigation}-a-header`),
      ).toBeInViewport()

      await relativeRouteB.click()

      await page.waitForURL(
        `http://localhost:${PORT}/relative/${navigation}/relative-${navigation}-b`,
      )

      await expect(
        page.getByTestId(`relative-${navigation}-header`),
      ).toBeInViewport()

      await expect(
        page.getByTestId(`relative-${navigation}-b-header`),
      ).toBeInViewport()

      await indexLink.click()

      await page.waitForURL(`http://localhost:${PORT}/relative/${navigation}`)

      await expect(
        page.getByTestId(`relative-${navigation}-header`),
      ).toBeInViewport()

      await expect(
        page.getByTestId(`relative-${navigation}-b-header`),
      ).not.toBeInViewport()

      await backLink.click()

      await page.waitForURL(`http://localhost:${PORT}/relative`)

      await expect(page.getByTestId(`relative-routing-home`)).toBeInViewport()
    })

    test(`nested chilren. navigation: ${navigation}`, async ({ page }) => {
      await page.waitForLoadState('networkidle')
      await page.goto(`/relative/${navigation}`)
      await page.waitForURL(`http://localhost:${PORT}/relative/${navigation}`)

      await expect(
        page.getByTestId(`relative-${navigation}-header`),
      ).toBeInViewport()

      const backLink = page.getByTestId(`relative-${navigation}-back`)

      const deeplyNestedChildRoute = page.getByTestId(
        `relative-${navigation}-deeply-nested`,
      )

      await deeplyNestedChildRoute.click()

      await page.waitForURL(
        `http://localhost:${PORT}/relative/${navigation}/nested/deep`,
      )

      await expect(
        page.getByTestId(`relative-${navigation}-nested-deep-header`),
      ).toBeInViewport()

      await backLink.click()

      await page.waitForURL(
        `http://localhost:${PORT}/relative/${navigation}/nested`,
      )

      await expect(
        page.getByTestId(`relative-${navigation}-nested-header`),
      ).toBeInViewport()
    })

    test(`with path params. navigation: ${navigation}`, async ({ page }) => {
      await page.waitForLoadState('networkidle')
      await page.goto(`/relative/${navigation}`)
      await page.waitForURL(`http://localhost:${PORT}/relative/${navigation}`)

      await expect(
        page.getByTestId(`relative-${navigation}-header`),
      ).toBeInViewport()

      const pathParamRoute = page.getByTestId(`relative-${navigation}-path`)

      await pathParamRoute.click()

      await page.waitForURL(
        `http://localhost:${PORT}/relative/${navigation}/path/a`,
      )

      expect(page.url().endsWith('/path/a')).toBe(true)

      await expect(
        page.getByTestId(`relative-${navigation}-path-param-header`),
      ).toBeInViewport()

      const switchParamLink = page.getByTestId(
        `relative-${navigation}-path-param-switchAB`,
      )

      await switchParamLink.click()

      await page.waitForURL(
        `http://localhost:${PORT}/relative/${navigation}/path/b`,
      )

      expect(page.url().endsWith('/path/b')).toBe(true)

      await expect(
        page.getByTestId(`relative-${navigation}-path-param-header`),
      ).toBeInViewport()
    })

    test(`with search params. navigation: ${navigation}`, async ({ page }) => {
      await page.waitForLoadState('networkidle')
      await page.goto(`/relative/${navigation}`)
      await page.waitForURL(`http://localhost:${PORT}/relative/${navigation}`)

      await expect(
        page.getByTestId(`relative-${navigation}-header`),
      ).toBeInViewport()

      const searchParamRoute = page.getByTestId(
        `relative-${navigation}-withSearch`,
      )

      await searchParamRoute.click()

      let expectedUrl = new URL(
        `http://localhost:${PORT}/relative/${navigation}/with-search?searchParam="1"`,
      )

      await page.waitForLoadState('domcontentloaded')

      expect(page.url().toString()).toBe(expectedUrl.toString())

      await expect(
        page.getByTestId(`relative-${navigation}-withSearch-header`),
      ).toBeInViewport()

      await expect(
        page.getByTestId(`relative-${navigation}-withSearch-header`),
      ).toContainText('searchParam: 1')

      const updateSearchLink = page.getByTestId(
        `relative-${navigation}-withSearch-update-param`,
      )

      await updateSearchLink.click()

      await page.waitForLoadState('domcontentloaded')

      expectedUrl = new URL(
        `http://localhost:${PORT}/relative/${navigation}/with-search?searchParam="2"`,
      )

      expect(page.url().toString()).toBe(expectedUrl.toString())

      await expect(
        page.getByTestId(`relative-${navigation}-withSearch-header`),
      ).toContainText('searchParam: 2')

      await expect(
        page.getByTestId(`relative-${navigation}-withSearch-header`),
      ).toBeInViewport()
    })

    test(`shouldn't cause excessive rendering. navigation: ${navigation}`, async ({
      page,
    }) => {
      let navigateMsgs = 0

      page.on('console', (msg) => {
        if (msg.text() === 'navigate') {
          navigateMsgs++
        }
      })

      await page.waitForLoadState('networkidle')
      await page.goto(`/relative/${navigation}`)
      await page.waitForURL(`http://localhost:${PORT}/relative/${navigation}`)

      await expect(
        page.getByTestId(`relative-${navigation}-header`),
      ).toBeInViewport()

      expect(navigateMsgs).toBe(1)
      const indexLink = page.getByTestId(`relative-${navigation}-index`)
      const backLink = page.getByTestId(`relative-${navigation}-back`)
      const relativeRouteA = page.getByTestId(`relative-${navigation}-a`)
      const relativeRouteB = page.getByTestId(`relative-${navigation}-b`)
      const deeplyNestedChildRoute = page.getByTestId(
        `relative-${navigation}-deeply-nested`,
      )
      const pathParamRoute = page.getByTestId(`relative-${navigation}-path`)
      const searchParamRoute = page.getByTestId(
        `relative-${navigation}-withSearch`,
      )

      await relativeRouteA.click()
      await page.waitForLoadState('domcontentloaded')
      await relativeRouteB.click()
      await page.waitForLoadState('domcontentloaded')
      await deeplyNestedChildRoute.click()
      await page.waitForLoadState('domcontentloaded')
      await backLink.click()
      await page.waitForLoadState('domcontentloaded')
      await pathParamRoute.click()
      await page.waitForLoadState('domcontentloaded')
      const switchParamLink = page.getByTestId(
        `relative-${navigation}-path-param-switchAB`,
      )
      await switchParamLink.click()
      await page.waitForLoadState('domcontentloaded')
      await searchParamRoute.click()
      await page.waitForLoadState('domcontentloaded')

      const updateSearchLink = page.getByTestId(
        `relative-${navigation}-withSearch-update-param`,
      )

      await updateSearchLink.click()
      await page.waitForLoadState('domcontentloaded')

      await indexLink.click()
      await page.waitForLoadState('domcontentloaded')

      expect(navigateMsgs).toBe(1)
    })
  })
})
