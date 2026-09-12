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

test('redirect respects basepath', async ({ page }) => {
  await page.goto(`/app/`)
  await expect(page.getByTestId(`home-component`)).toBeInViewport()

  const redirectBtn = page.getByTestId(`to-redirect-btn`)
  await redirectBtn.click()
  await page.waitForURL('/app/about')
  await expect(page.getByTestId(`about-component`)).toBeInViewport()
})

test('redirect respects basepath with reloadDocument = true on redirect', async ({
  page,
}) => {
  await page.goto(`/app/`)
  await expect(page.getByTestId(`home-component`)).toBeInViewport()

  const redirectBtn = page.getByTestId(`to-redirect-reload-btn`)
  await redirectBtn.click()
  await page.waitForURL('/app/about')
  await expect(page.getByTestId(`about-component`)).toBeInViewport()
})

test('navigate() with href containing basepath', async ({ page }) => {
  await page.goto(`/app/`)
  await expect(page.getByTestId(`home-component`)).toBeInViewport()

  const aboutBtn = page.getByTestId(`to-about-href-with-basepath-btn`)
  await aboutBtn.click()
  // Should navigate to /app/about, NOT /app/app/about
  await page.waitForURL('/app/about')
  await expect(page.getByTestId(`about-component`)).toBeInViewport()
})

test('navigate() with href containing basepath and reloadDocument=true', async ({
  page,
}) => {
  await page.goto(`/app/`)
  await expect(page.getByTestId(`home-component`)).toBeInViewport()

  const aboutBtn = page.getByTestId(`to-about-href-with-basepath-reload-btn`)
  await aboutBtn.click()
  // Should navigate to /app/about, NOT stay on current page
  await page.waitForURL('/app/about')
  await expect(page.getByTestId(`about-component`)).toBeInViewport()
})
