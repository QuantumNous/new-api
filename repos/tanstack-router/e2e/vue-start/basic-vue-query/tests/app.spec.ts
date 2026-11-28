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

test('Navigating nested layouts', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'Layout', exact: true }).click()
  await page.getByRole('link', { name: 'Layout A' }).click()
  await expect(page.locator('body')).toContainText("I'm A!")
  await page.getByRole('link', { name: 'Layout B' }).click()
  await expect(page.locator('body')).toContainText("I'm B!")
})

test('Navigating to a not-found route', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('link', { name: 'This Route Does Not Exist' }).click()
  await page.getByRole('link', { name: 'Start Over' }).click()
  await expect(page.getByRole('heading')).toContainText('Welcome Home!')
})

test('Manual Suspense boundaries should transition on navigation', async ({
  page,
}) => {
  // Navigate to the suspense transition test page
  await page.goto('/suspense-transition')

  // Wait for initial content to load
  await expect(page.getByTestId('n-value')).toHaveText('1')
  await expect(page.getByTestId('double-value')).toHaveText('2')

  // Click the increase button to trigger navigation with search params change
  await page.getByTestId('increase-button').click()

  // During the transition, the old content should remain visible
  // and the fallback should NOT be shown
  await expect(page.getByTestId('suspense-fallback')).not.toBeVisible({
    timeout: 100,
  })

  // The old content should still be visible during transition
  await expect(page.getByTestId('suspense-content')).toBeVisible()

  // After transition completes, new content should be visible
  await expect(page.getByTestId('n-value')).toHaveText('2')
  await expect(page.getByTestId('double-value')).toHaveText('4')
})
