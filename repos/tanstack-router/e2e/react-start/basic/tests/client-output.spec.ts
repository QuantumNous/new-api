import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.skip(
  process.env.TSS_RSB_CLIENT_OUTPUT !== 'iife',
  'IIFE client output assertions only run in rsbuild/ssr/iife mode',
)

test('SSR HTML emits IIFE client scripts and classic script preloads', async ({
  page,
}) => {
  const response = await page.goto('/posts')
  const html = await response!.text()

  expect(html).not.toContain('rel="modulepreload"')
  expect(html).toMatch(/<link[^>]+rel="preload"[^>]+as="script"/)

  const clientEntry = html.match(
    /<script\b[^>]+src="([^"]*\/assets\/js\/index[^"]*)"[^>]*>/,
  )
  expect(clientEntry).toBeTruthy()
  expect(clientEntry![0]).toContain('async')
  expect(clientEntry![0]).not.toContain('type="module"')

  await expect(
    page.getByRole('link', { name: 'sunt aut facere repe' }),
  ).toBeVisible()

  await page.getByRole('link', { name: 'sunt aut facere repe' }).click()

  await expect(page.getByRole('heading')).toContainText('sunt aut facere')
})
