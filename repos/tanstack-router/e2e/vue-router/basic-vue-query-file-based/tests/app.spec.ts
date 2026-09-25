import { expect, test } from '@playwright/test'
import { getDummyServerPort } from '@tanstack/router-e2e-utils'
import packageJson from '../package.json' with { type: 'json' }

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('GetPosts', async () => {
  const port = await getDummyServerPort(packageJson.name)
  const res = await fetch(`http://localhost:${port}/posts`)

  expect(res.status).toBe(200)

  const posts = await res.json()

  expect(posts.length).toBeGreaterThan(0)

  const postRes = await fetch(`http://localhost:${port}/posts/1`)
  expect(postRes.status).toBe(200)
  const post = await postRes.json()
  expect(post).toEqual(posts[0])
})

test('Navigating to a post page', async ({ page }) => {
  await page.getByRole('link', { name: 'Posts' }).click()
  await page.getByRole('link', { name: 'sunt aut facere repe' }).click()
  await expect(page.getByRole('heading')).toContainText('sunt aut facere')
})

test('Navigating nested layouts', async ({ page }) => {
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
