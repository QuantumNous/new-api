import { expect, test } from '@playwright/test'

// Reproduces https://github.com/TanStack/router/issues/7195
test('layout with useQuery renders child after client navigation', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByText('👉 To page2')).toBeVisible()
  await page.waitForLoadState('networkidle')

  await page.getByText('👉 To page2').click()

  await expect(page.getByTestId('page2-content')).toBeVisible({
    timeout: 5_000,
  })
  await expect(page.getByTestId('layout-content')).toBeVisible()
})
