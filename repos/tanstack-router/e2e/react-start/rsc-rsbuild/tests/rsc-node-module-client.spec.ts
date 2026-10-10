import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test('hydrates client component imported from node_modules in RSC', async ({
  page,
}) => {
  const response = await page.goto('/rsc-node-module-client')
  expect(response?.status()).toBe(200)

  await expect(page.getByTestId('rsc-node-module-client-title')).toHaveText(
    'RSC node_modules client component',
  )
  await expect(page.getByTestId('rsc-node-module-client-server')).toBeVisible()
  await expect(page.getByTestId('node-module-client-widget')).toHaveText(
    'Node module clicks: 0',
  )

  await waitForHydration(page)
  await page.getByTestId('node-module-client-widget').click()
  await expect(page.getByTestId('node-module-client-widget')).toHaveText(
    'Node module clicks: 1',
  )
})
