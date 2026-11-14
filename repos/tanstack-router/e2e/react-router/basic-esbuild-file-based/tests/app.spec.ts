import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('Navigating to a post page', async ({ page }) => {
  await page.getByRole('link', { name: 'Posts' }).click()
  await page.getByRole('link', { name: 'sunt aut facere repe' }).click()
  await expect(page.getByRole('heading')).toContainText('sunt aut facere')
})

test('Navigating nested layouts', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Layout', exact: true }).click()

  await expect(page.locator('#app')).toContainText("I'm a layout")
  await expect(page.locator('#app')).toContainText("I'm a nested layout")

  await page.getByRole('link', { name: 'Layout A' }).click()
  await expect(page.locator('#app')).toContainText("I'm layout A!")

  await page.getByRole('link', { name: 'Layout B' }).click()
  await expect(page.locator('#app')).toContainText("I'm layout B!")
})

test('Navigating to a not-found route', async ({ page }) => {
  await page.getByRole('link', { name: 'This Route Does Not Exist' }).click()
  await expect(page.getByRole('paragraph')).toContainText(
    'This is the notFoundComponent configured on root route',
  )
  await page.getByRole('link', { name: 'Start Over' }).click()
  await expect(page.getByRole('heading')).toContainText('Welcome Home!')
})

test('Navigating to a route inside a route group', async ({ page }) => {
  await page.getByTestId('link-to-route-inside-group').click()
  await expect(page.getByTestId('search-via-hook')).toContainText('world')
  await expect(page.getByTestId('search-via-route-hook')).toContainText('world')
  await expect(page.getByTestId('search-via-route-api')).toContainText('world')
})

test('Navigating to a lazy route inside a route group', async ({ page }) => {
  await page.getByTestId('link-to-lazy-route-inside-group').click()
  await expect(page.getByTestId('search-via-hook')).toContainText('world')
  await expect(page.getByTestId('search-via-route-hook')).toContainText('world')
  await expect(page.getByTestId('search-via-route-api')).toContainText('world')
})
