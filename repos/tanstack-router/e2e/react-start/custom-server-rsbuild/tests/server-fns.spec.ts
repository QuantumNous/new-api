import { expect, test } from '@playwright/test'

test('loader SSRs the greeting from a server function', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)

  const loaderGreeting = page.getByTestId('loader-greeting')
  await expect(loaderGreeting).toHaveText('Hello, Loader!')
})

test('GET server function resolves on the client', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('loader-greeting')).toHaveText('Hello, Loader!')

  await page.getByRole('button', { name: 'Call getGreeting' }).click()

  await expect(page.getByTestId('client-greeting')).toHaveText('Hello, Client!')
})

test('POST server function resolves on the client', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('loader-greeting')).toHaveText('Hello, Loader!')

  await page.getByRole('button', { name: 'Call postMessage' }).click()

  await expect(page.getByTestId('echo-result')).toHaveText(
    'Echo: hello from client',
  )
})
