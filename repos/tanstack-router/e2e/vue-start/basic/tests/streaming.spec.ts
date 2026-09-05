import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test('Navigating to deferred route', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Deferred' }).click()

  await expect(page.getByTestId('regular-person')).toContainText('John Doe')
  await expect(page.getByTestId('deferred-person')).toContainText(
    'Tanner Linsley',
  )
  await expect(page.getByTestId('deferred-stuff')).toContainText(
    'Hello deferred!',
  )
})

test('Directly visiting the deferred route', async ({ page }) => {
  await page.goto('/deferred')

  await expect(page.getByTestId('regular-person')).toContainText('John Doe')
  await expect(page.getByTestId('deferred-person')).toContainText(
    'Tanner Linsley',
  )
  await expect(page.getByTestId('deferred-stuff')).toContainText(
    'Hello deferred!',
  )
})

test('Counter increments on click', async ({ page }) => {
  await page.goto('/deferred')

  // Wait for content to load
  await expect(page.getByTestId('regular-person')).toContainText('John Doe')

  // Wait for Vue hydration to complete by checking that the app is interactive
  // The Scripts component adds scripts after hydration, so wait for network idle
  await page.waitForLoadState('networkidle')

  // Check initial count
  await expect(page.getByTestId('count')).toContainText('Count: 0')

  // Click increment button
  await page.getByTestId('increment').click()

  // Check updated count
  await expect(page.getByTestId('count')).toContainText('Count: 1')

  // Click again
  await page.getByTestId('increment').click()
  await expect(page.getByTestId('count')).toContainText('Count: 2')
})
