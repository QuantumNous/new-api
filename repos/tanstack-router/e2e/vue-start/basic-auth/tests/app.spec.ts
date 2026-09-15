import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => typeof (window as any).$_TSR === 'undefined')
}

async function signup(page: Page, email: string, password: string) {
  await page.goto('/signup')
  await waitForHydration(page)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: 'Sign Up' }).click()
  await page.waitForSelector('text=Logout')
}

async function login(
  page: Page,
  email: string,
  password: string,
  signupOnFail = false,
) {
  await page.goto('/login')
  await waitForHydration(page)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.getByRole('button', { name: 'Login' }).click()

  if (signupOnFail) {
    await page.waitForSelector('text=User not found')
    await page.click('button:has-text("Sign up instead?")')
    await page.waitForSelector('text=Logout')
  }
}

test('Posts redirects to login when not authenticated', async ({ page }) => {
  await page.goto('/posts')
  await expect(page.locator('h1')).toContainText('Login')
})

test('Login fails with user not found', async ({ page }) => {
  const email = `missing-${Date.now()}@gmail.com`
  await login(page, email, 'badpassword')
  await expect(page.getByText('User not found')).toBeVisible()
})

test('Login fails with incorrect password', async ({ page }) => {
  const email = `incorrect-password-${Date.now()}@gmail.com`
  await signup(page, email, 'test')
  await page.goto('/logout')
  await login(page, email, 'badpassword')
  await expect(page.getByText('Incorrect password')).toBeVisible()
})

test('Can sign up from a not found user', async ({ page }) => {
  const email = `new-${Date.now()}@gmail.com`
  await login(page, email, 'badpassword', true)
  await expect(page.getByText(email)).toBeVisible()
})

test('Navigating to post after logging in', async ({ page }) => {
  const email = `posts-${Date.now()}@gmail.com`
  await signup(page, email, 'test')
  await page.getByRole('link', { name: 'Posts' }).click()
  await page.getByRole('link', { name: 'sunt aut facere repe' }).click()
  await expect(page.getByRole('heading')).toContainText('sunt aut facere')
})
