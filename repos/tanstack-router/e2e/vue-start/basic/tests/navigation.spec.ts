import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.use({
  whitelistErrors: [
    'Failed to load resource: the server responded with a status of 404',
  ],
})
test('Navigating to post', async ({ page }) => {
  await page.goto('/')

  await page.waitForURL('/')

  await page.getByRole('link', { name: 'Posts' }).click()
  await page.getByRole('link', { name: 'sunt aut facere repe' }).click()
  await page.getByRole('link', { name: 'Deep View' }).click()
  await expect(page.getByRole('heading')).toContainText('sunt aut facere')
})

test('Navigating to user', async ({ page }) => {
  await page.goto('/')

  await page.waitForURL('/')

  await page.getByRole('link', { name: 'Users' }).click()
  await page.getByRole('link', { name: 'Leanne Graham' }).click()
  await expect(page.getByRole('heading')).toContainText('Leanne Graham')
})

test('Navigating nested layouts', async ({ page }) => {
  await page.goto('/')

  await page.waitForURL('/')

  await page.getByRole('link', { name: 'Layout', exact: true }).click()

  await expect(page.locator('body')).toContainText("I'm a layout")
  await expect(page.locator('body')).toContainText("I'm a nested layout")

  await page.getByRole('link', { name: 'Layout A' }).click()
  await expect(page.locator('body')).toContainText("I'm layout A!")

  await page.getByRole('link', { name: 'Layout B' }).click()
  await expect(page.locator('body')).toContainText("I'm layout B!")
})

test('client side navigating to a route with scripts', async ({ page }) => {
  await page.goto('/')

  await page.waitForURL('/')
  await page.getByRole('link', { name: 'Scripts', exact: true }).click()
  await expect(page.getByTestId('scripts-test-heading')).toBeInViewport()
  expect(await page.evaluate('window.SCRIPT_1')).toBe(true)
  expect(await page.evaluate('window.SCRIPT_2')).toBe(undefined)
})

test('directly going to a route with scripts', async ({ page }) => {
  await page.goto('/scripts')

  await page.waitForURL('/scripts')
  await page.waitForLoadState('networkidle')
  expect(await page.evaluate('window.SCRIPT_1')).toBe(true)
  expect(await page.evaluate('window.SCRIPT_2')).toBe(undefined)
})

test('Navigating to a not-found route', async ({ page }) => {
  await page.goto('/')

  await page.waitForURL('/')

  await page.getByRole('link', { name: 'This Route Does Not Exist' }).click()
  await page.getByRole('link', { name: 'Start Over' }).click()
  await expect(page.getByRole('heading')).toContainText('Welcome Home!')
})

test('Should change title on client side navigation', async ({ page }) => {
  await page.goto('/')

  await page.waitForURL('/')

  await page.getByRole('link', { name: 'Posts' }).click()

  await expect(page).toHaveTitle('Posts page')
})
