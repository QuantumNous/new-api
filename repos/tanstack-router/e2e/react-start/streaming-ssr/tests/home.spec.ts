import { expect, test, testWithHydration } from './fixtures'

test.describe('Home page', () => {
  testWithHydration(
    'renders index page with all navigation links',
    async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      await expect(page.getByTestId('index-title')).toContainText(
        'Streaming SSR Test Scenarios',
      )
      // Check links exist (they're in the nav and the body)
      await expect(
        page.getByRole('link', { name: 'Deferred' }).first(),
      ).toBeVisible()
      await expect(
        page.getByRole('link', { name: 'Stream' }).first(),
      ).toBeVisible()
    },
  )

  testWithHydration(
    'navigation from home to routes works',
    async ({ page }) => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      // Use the link in the content (not nav)
      await page.getByTestId('link-deferred').click()
      await expect(page).toHaveURL('/deferred')
    },
  )
})
