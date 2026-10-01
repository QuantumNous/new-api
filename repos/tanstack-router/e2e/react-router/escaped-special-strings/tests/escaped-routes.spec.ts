import { expect, test } from '@playwright/test'

test.describe('Escaped special strings routing', () => {
  test('home index route renders at / path', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByTestId('page-title')).toContainText('Home Page')
    await expect(page.getByTestId('page-path')).toContainText('/')
    await expect(page.getByTestId('page-description')).toContainText(
      'home/index route at /',
    )
  })

  test('escaped [index] route renders at /index path', async ({ page }) => {
    await page.goto('/index')

    await expect(page.getByTestId('page-title')).toContainText(
      'Escaped Index Page',
    )
    await expect(page.getByTestId('page-path')).toContainText('/index')
    await expect(page.getByTestId('page-description')).toContainText(
      'escape the special "index" token',
    )
  })

  test('escaped [route] route renders at /route path', async ({ page }) => {
    await page.goto('/route')

    await expect(page.getByTestId('page-title')).toContainText(
      'Escaped Route Page',
    )
    await expect(page.getByTestId('page-path')).toContainText('/route')
    await expect(page.getByTestId('page-description')).toContainText(
      'escape the special "route" token',
    )
  })

  test('escaped [lazy] route renders at /lazy path', async ({ page }) => {
    await page.goto('/lazy')

    await expect(page.getByTestId('page-title')).toContainText(
      'Escaped Lazy Page',
    )
    await expect(page.getByTestId('page-path')).toContainText('/lazy')
    await expect(page.getByTestId('page-description')).toContainText(
      'escape the special "lazy" token',
    )
  })

  test('escaped [_]layout route renders at /_layout path', async ({ page }) => {
    await page.goto('/_layout')

    await expect(page.getByTestId('page-title')).toContainText(
      'Escaped Underscore Layout Page',
    )
    await expect(page.getByTestId('page-path')).toContainText('/_layout')
    await expect(page.getByTestId('page-description')).toContainText(
      'escape the leading underscore',
    )
  })

  test('escaped blog[_] route renders at /blog_ path', async ({ page }) => {
    await page.goto('/blog_')

    await expect(page.getByTestId('page-title')).toContainText(
      'Escaped Blog Underscore Page',
    )
    await expect(page.getByTestId('page-path')).toContainText('/blog_')
    await expect(page.getByTestId('page-description')).toContainText(
      'escape the trailing underscore',
    )
  })

  test('client-side navigation to home / route', async ({ page }) => {
    await page.goto('/index')
    await page.getByTestId('link-home').click()
    await page.waitForURL('/')

    await expect(page.getByTestId('page-title')).toContainText('Home Page')
  })

  test('client-side navigation to escaped /index route', async ({ page }) => {
    await page.goto('/route')
    await page.getByTestId('link-index').click()
    await page.waitForURL('/index')

    await expect(page.getByTestId('page-title')).toContainText(
      'Escaped Index Page',
    )
  })

  test('client-side navigation to escaped /route route', async ({ page }) => {
    await page.goto('/index')
    await page.getByTestId('link-route').click()
    await page.waitForURL('/route')

    await expect(page.getByTestId('page-title')).toContainText(
      'Escaped Route Page',
    )
  })

  test('client-side navigation to escaped /lazy route', async ({ page }) => {
    await page.goto('/index')
    await page.getByTestId('link-lazy').click()
    await page.waitForURL('/lazy')

    await expect(page.getByTestId('page-title')).toContainText(
      'Escaped Lazy Page',
    )
  })

  test('client-side navigation to escaped /_layout route', async ({ page }) => {
    await page.goto('/index')
    await page.getByTestId('link-underscore-layout').click()
    await page.waitForURL('/_layout')

    await expect(page.getByTestId('page-title')).toContainText(
      'Escaped Underscore Layout Page',
    )
  })

  test('client-side navigation to escaped /blog_ route', async ({ page }) => {
    await page.goto('/index')
    await page.getByTestId('link-blog-underscore').click()
    await page.waitForURL('/blog_')

    await expect(page.getByTestId('page-title')).toContainText(
      'Escaped Blog Underscore Page',
    )
  })

  test('URL is correct for escaped routes with underscores', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/_layout')
    expect(page.url()).toBe(`${baseURL}/_layout`)

    await page.goto('/blog_')
    expect(page.url()).toBe(`${baseURL}/blog_`)
  })
})
