import { expect, test } from '@playwright/test'

test('navigate() respects basepath for when reloadDocument=true', async ({
  page,
}) => {
  await page.goto(`/app/`)
  await expect(page.getByTestId(`home-component`)).toBeInViewport()

  const aboutBtn = page.getByTestId(`to-about-btn`)
  await aboutBtn.click()
  await page.waitForURL('/app/about')
  await expect(page.getByTestId(`about-component`)).toBeInViewport()

  const homeBtn = page.getByTestId(`to-home-btn`)
  await homeBtn.click()
  await page.waitForURL('/app/')
  await expect(page.getByTestId(`home-component`)).toBeInViewport()
})
