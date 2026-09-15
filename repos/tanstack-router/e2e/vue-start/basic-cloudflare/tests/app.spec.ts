import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test('returns the correct user agent', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('message')).toHaveText(
    'Running in Cloudflare-Workers',
  )
})

test('returns the correct value from a Cloudflare binding', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('myVar')).toHaveText('Hello from Cloudflare')
})

test('prerender with Cloudflare Workers runtime', async ({ page }) => {
  // Verify the static page was prerendered during build
  const distDir = join(process.cwd(), 'dist', 'client')
  expect(existsSync(join(distDir, 'static', 'index.html'))).toBe(true)

  // Verify the page loads correctly
  await page.goto('/static')
  await expect(page.getByTestId('static-heading')).toHaveText('Static Page')
  await expect(page.getByTestId('static-content')).toHaveText(
    'The value is Hello from Cloudflare',
  )
})
