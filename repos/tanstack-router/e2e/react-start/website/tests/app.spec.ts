import { expect, test } from '@playwright/test'

const routeTestId = 'selected-route-label'

test('resolves to the latest version on load of a project like "/router"', async ({
  page,
}) => {
  await page.goto('/router')

  await expect(page.getByTestId(routeTestId)).toContainText('/router/latest')
})

test('resolves to the overview docs page', async ({ page }) => {
  await page.goto('/router/latest/docs')

  await expect(page.getByTestId(routeTestId)).toContainText(
    '/router/latest/docs/framework/react/overview',
  )
})

test('clicking on Documentation link navigates to the overview docs page', async ({
  page,
}) => {
  await page.goto('/router')
  await page.waitForLoadState('networkidle')

  const documentationLink = page.getByLabel('Documentation')
  await documentationLink.click()
  await page.waitForLoadState('networkidle')

  const pathname = new URL(page.url()).pathname
  expect(pathname).toBe('/router/latest/docs/framework/react/overview')
})
