import { expect, type Page } from '@playwright/test'

export async function waitForHydration(page: Page) {
  await expect(page.getByTestId('app-hydrated')).toHaveText('hydrated', {
    timeout: 15000,
  })
}
