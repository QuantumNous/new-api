import { expect } from '@playwright/test'
import { DEV_STYLES_ATTR } from '@tanstack/router-core'
import { test } from '@tanstack/router-e2e-utils'
import { ssrStylesMode } from '../env'

// Whitelist errors that can occur in CI:
// - net::ERR_NAME_NOT_RESOLVED: transient network issues
// - 504 (Outdated Optimize Dep): Vite dependency optimization reload
const whitelistErrors = [
  'Failed to load resource: net::ERR_NAME_NOT_RESOLVED',
  'Failed to load resource: the server responded with a status of 504',
]

test.describe(`dev.ssrStyles (mode=${ssrStylesMode})`, () => {
  test.use({ whitelistErrors })

  test('page renders correctly', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-heading')).toHaveText(
      'Dev SSR Styles Test',
    )
  })

  if (ssrStylesMode === 'default') {
    test.describe('default (enabled, basepath = vite base)', () => {
      test.use({ javaScriptEnabled: false, whitelistErrors })

      test('SSR HTML contains dev styles link tag', async ({ request }) => {
        const response = await request.get('/')
        expect(response.ok()).toBeTruthy()
        const html = await response.text()

        // Should have a dev styles link tag.
        expect(html).toContain('/@tanstack-start/styles.css')
        expect(html).toContain(DEV_STYLES_ATTR)
      })

      test('dev styles link uses vite base (/) as basepath prefix', async ({
        request,
      }) => {
        const response = await request.get('/')
        expect(response.ok()).toBeTruthy()
        const html = await response.text()

        // With default vite base (/), the dev styles URL should be
        // /@tanstack-start/styles.css (no extra prefix)
        const match = html.match(
          /href="([^"]*@tanstack-start\/styles\.css[^"]*)"/,
        )
        expect(match).toBeTruthy()
        const href = match![1]
        expect(href).toMatch(/^\/@tanstack-start\/styles\.css/)
      })

      test('CSS is applied on initial page load (SSR)', async ({ page }) => {
        await page.goto('/')

        const element = page.getByTestId('styled-box')
        await expect(element).toBeVisible()

        // Verify the CSS is applied: #3b82f6 (blue-500) in RGB is rgb(59, 130, 246)
        const backgroundColor = await element.evaluate(
          (el) => getComputedStyle(el).backgroundColor,
        )
        expect(backgroundColor).toBe('rgb(59, 130, 246)')
      })
    })
  }

  if (ssrStylesMode === 'disabled') {
    test.describe('disabled (enabled=false)', () => {
      test('SSR HTML does NOT contain dev styles link tag', async ({
        request,
      }) => {
        const response = await request.get('/')
        expect(response.ok()).toBeTruthy()
        const html = await response.text()

        // Should NOT have a dev styles link tag.
        expect(html).not.toContain('/@tanstack-start/styles.css')
        expect(html).not.toContain(DEV_STYLES_ATTR)
      })

      test('page still renders without dev styles', async ({ page }) => {
        await page.goto('/')
        await expect(page.getByTestId('home-heading')).toHaveText(
          'Dev SSR Styles Test',
        )
        // The styled box should exist but may not have CSS applied via SSR
        await expect(page.getByTestId('styled-box')).toBeVisible()
      })
    })
  }

  if (ssrStylesMode === 'custom-basepath') {
    test.describe('custom basepath (/custom-styles/)', () => {
      test('SSR HTML contains dev styles link with custom basepath', async ({
        request,
      }) => {
        const response = await request.get('/')
        expect(response.ok()).toBeTruthy()
        const html = await response.text()

        // The dev styles URL should use /custom-styles/ as the basepath prefix
        const match = html.match(
          /href="([^"]*@tanstack-start\/styles\.css[^"]*)"/,
        )
        expect(match).toBeTruthy()
        const href = match![1]
        expect(href).toMatch(/^\/custom-styles\/@tanstack-start\/styles\.css/)
        expect(html).toContain(DEV_STYLES_ATTR)
      })

      test.describe('with JavaScript disabled', () => {
        test.use({ javaScriptEnabled: false, whitelistErrors })

        test('CSS is applied on initial page load (SSR) with custom basepath', async ({
          page,
        }) => {
          await page.goto('/')

          const element = page.getByTestId('styled-box')
          await expect(element).toBeVisible()

          // Verify the CSS is applied: #3b82f6 (blue-500) in RGB is rgb(59, 130, 246)
          const backgroundColor = await element.evaluate(
            (el) => getComputedStyle(el).backgroundColor,
          )
          expect(backgroundColor).toBe('rgb(59, 130, 246)')
        })
      })
    })
  }
})
