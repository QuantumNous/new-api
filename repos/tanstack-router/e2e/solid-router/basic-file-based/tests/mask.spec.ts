import { expect, test } from '@playwright/test'

test('route masks transform params and expose masked pathname in the browser (solid)', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByTestId('link-to-masks').click()
  await expect(page.getByText('Route Masks')).toBeVisible()

  const link = page.getByTestId('link-to-admin-mask')
  await link.click()

  await page.waitForURL('/masks/public/user-42')

  await expect(page.getByTestId('admin-user-component')).toBeInViewport()
  await expect(page.getByTestId('admin-user-id')).toHaveText('42')

  await expect(page.getByTestId('router-pathname')).toHaveText(
    '/masks/admin/42',
  )

  await expect(page.getByTestId('router-masked-pathname')).toHaveText(
    '/masks/public/user-42',
  )
})
