import { expect, test } from '@playwright/test'

test('Navigating to post', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Posts' }).click()
  await page.getByRole('link', { name: 'sunt aut facere repe' }).click()
  await page.getByRole('link', { name: 'Deep View' }).click()
  await expect(page.getByRole('heading')).toContainText('sunt aut facere')
})

test('Navigating to user', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Users' }).click()
  await page.getByRole('link', { name: 'Leanne Graham' }).click()
  await expect(page.getByRole('heading')).toContainText('Leanne Graham')
})

test('Navigating to a not-found route', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'This Route Does Not Exist' }).click()
  await page.getByRole('link', { name: 'Start Over' }).click()
  await expect(page.getByRole('heading')).toContainText('Welcome Home!')
})

test('Should change title on client side navigation', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Posts' }).click()

  await expect(page).toHaveTitle('Posts page')
})

test('Server function URLs correctly include app basepath', async ({
  page,
}) => {
  await page.goto('/logout')

  const form = page.locator('form')
  const actionUrl = await form.getAttribute('action')

  expect(actionUrl).toMatch(/^\/custom\/basepath\/_serverFn\//)
})

test('client-side redirect', async ({ page, baseURL }) => {
  await page.goto('/redirect')
  await page.getByTestId('link-to-throw-it').click()
  await page.waitForLoadState('networkidle')

  expect(await page.getByTestId('post-view').isVisible()).toBe(true)
  expect(page.url()).toBe(`${baseURL}/posts/1`)
})

test('server-side redirect', async ({ page, baseURL }) => {
  await page.goto('/redirect/throw-it')
  await page.waitForLoadState('networkidle')

  expect(await page.getByTestId('post-view').isVisible()).toBe(true)
  expect(page.url()).toBe(`${baseURL}/posts/1`)

  // do not follow redirects since we want to test the Location header
  // first go to the route WITHOUT the base path, this will just add the base path
  await page.request
    .get('/redirect/throw-it', { maxRedirects: 0 })
    .then((res) => {
      const headers = new Headers(res.headers())
      expect(headers.get('location')).toBe('/custom/basepath/redirect/throw-it')
    })
  await page.request
    .get('/custom/basepath/redirect/throw-it', { maxRedirects: 0 })
    .then((res) => {
      const headers = new Headers(res.headers())
      expect(headers.get('location')).toBe('/custom/basepath/posts/1')
    })
})
