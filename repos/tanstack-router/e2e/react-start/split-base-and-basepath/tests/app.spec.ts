import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

const whitelistErrors = [
  'Failed to load resource: net::ERR_NAME_NOT_RESOLVED',
  'Failed to load resource: the server responded with a status of 504',
]

test.describe('split base and basepath', () => {
  test.use({ whitelistErrors })
  test('page renders at root /', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-heading')).toHaveText('Welcome Home')
  })

  test('SSR HTML contains asset URLs prefixed with /_ui/', async ({
    request,
  }) => {
    const response = await request.get('/')
    expect(response.ok()).toBeTruthy()
    const html = await response.text()

    // Script tags should reference /_ui/ prefix
    const scriptSrcMatches = html.match(/src="([^"]+)"/g) || []
    const moduleScripts = scriptSrcMatches.filter(
      (s) => s.includes('.js') || s.includes('.ts') || s.includes('@'),
    )

    for (const script of moduleScripts) {
      // Extract the URL from src="..."
      const url = script.replace(/^src="/, '').replace(/"$/, '')
      // Asset URLs should start with /_ui/
      expect(url, `Script URL should be prefixed with /_ui/: ${url}`).toMatch(
        /^\/_ui\//,
      )
    }

    // All stylesheet links (including dev styles) should reference /_ui/ prefix.
    // Dev styles default basepath is the Vite base, so they get /_ui/ too.
    const stylesheetMatches = html.match(/href="([^"]+\.css[^"]*)"/g) || []
    for (const match of stylesheetMatches) {
      const href = match.replace(/^href="/, '').replace(/"$/, '')
      expect(
        href,
        `Stylesheet URL should be prefixed with /_ui/: ${href}`,
      ).toMatch(/^\/_ui\//)
    }
  })

  test('CSS loads and applies correctly', async ({ page }) => {
    await page.goto('/')
    // The body should have font-family: sans-serif from our CSS
    const fontFamily = await page.evaluate(() => {
      return window.getComputedStyle(document.body).fontFamily
    })
    expect(fontFamily).toContain('sans-serif')
  })

  test('client-side navigation works', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('home-heading')).toBeVisible()

    // Click the About link
    await page.getByTestId('link-about').click()

    // Should navigate to /about
    await expect(page.getByTestId('about-heading')).toHaveText('About Page')
    await expect(page.getByTestId('about-content')).toBeVisible()

    // URL should be at /about, not /_ui/about
    expect(page.url()).toContain('/about')
    expect(page.url()).not.toContain('/_ui/about')
  })

  test('navigation links do not have /_ui/ prefix', async ({ page }) => {
    await page.goto('/')

    // Check that the Home link href is at / (not /_ui/)
    const homeHref = await page.getByTestId('link-home').getAttribute('href')
    expect(homeHref).toBe('/')

    // Check that the About link href is at /about (not /_ui/about)
    const aboutHref = await page.getByTestId('link-about').getAttribute('href')
    expect(aboutHref).toBe('/about')
  })

  test('navigating directly to /about works via SSR', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByTestId('about-heading')).toHaveText('About Page')
  })

  test('navigate back to home after visiting about', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('link-about').click()
    await expect(page.getByTestId('about-heading')).toBeVisible()

    await page.getByTestId('link-home').click()
    await expect(page.getByTestId('home-heading')).toBeVisible()
  })
})
