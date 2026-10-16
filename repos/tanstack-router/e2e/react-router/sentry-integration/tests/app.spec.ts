import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('should load', async ({ page }) => {
  await expect(page.getByRole('heading')).toContainText('Welcome Home!')
})
