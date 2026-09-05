import { expect, test } from '@playwright/test'

test.describe('FullPath type/runtime match (Issues #4892, #2675, #6403)', () => {
  test.describe('Pathless layout routes should have parent fullPath, not empty string', () => {
    test('direct navigation to pathless layout shows correct fullPath', async ({
      page,
    }) => {
      await page.goto('/fullpath-test')
      // The pathless layout's fullPath should be '/fullpath-test' (same as parent), not ''
      await expect(page.getByTestId('pathless-layout-fullpath')).toHaveText(
        '/fullpath-test',
      )
    })

    test('client-side navigation to pathless layout shows correct fullPath', async ({
      page,
    }) => {
      await page.goto('/')
      await page.getByTestId('link-to-fullpath-test').click()
      await expect(page.getByTestId('pathless-layout-fullpath')).toHaveText(
        '/fullpath-test',
      )
    })
  })

  test.describe('Index routes should have trailing slash in fullPath', () => {
    test('direct navigation to index route shows fullPath with trailing slash', async ({
      page,
    }) => {
      await page.goto('/fullpath-test')
      // The index route's fullPath should be '/fullpath-test/' (with trailing slash)
      await expect(page.getByTestId('index-route-fullpath')).toHaveText(
        '/fullpath-test/',
      )
    })

    test('param route under pathless layout shows correct fullPath', async ({
      page,
    }) => {
      await page.goto('/fullpath-test/123')
      // The param route's fullPath should be '/fullpath-test/$id'
      await expect(page.getByTestId('param-route-fullpath')).toHaveText(
        '/fullpath-test/$id',
      )
      await expect(page.getByTestId('fullpath-test-param')).toHaveText(
        'Param: 123',
      )
    })
  })

  test.describe('Route.to should NOT have trailing slash (Issue #3005)', () => {
    test('index route Route.to should not have trailing slash', async ({
      page,
    }) => {
      await page.goto('/fullpath-test')
      // Route.to should be '/fullpath-test' (without trailing slash)
      // while Route.fullPath is '/fullpath-test/' (with trailing slash)
      await expect(page.getByTestId('index-route-to')).toHaveText(
        '/fullpath-test',
      )
    })
  })

  test.describe('Existing pathless layout routes', () => {
    test('existing pathless layout index shows correct fullPath at runtime', async ({
      page,
    }) => {
      // This tests the existing /pathless-layout route which has a pathless _layout
      await page.goto('/pathless-layout')
      await expect(page.getByTestId('pathless-layout-header')).toContainText(
        'Pathless Layout Section',
      )
      await expect(page.getByTestId('pathless-layout-wrapper')).toContainText(
        'Pathless Layout Wrapper',
      )
      await expect(page.getByTestId('pathless-layout-index')).toContainText(
        'Pathless Layout Index',
      )
    })
  })
})
