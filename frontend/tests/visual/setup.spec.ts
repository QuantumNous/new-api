import { expect, test } from '@playwright/test'

import {
  assertInteractiveCentersVisible,
  assertNoHorizontalOverflow,
  configureStablePage,
  waitForStablePage,
} from './fixtures'

test.describe('setup wizard', () => {
  const setupApiPattern = /\/api\/setup(?:\?.*)?$/

  for (const theme of ['light', 'dark'] as const) {
    for (const viewport of [
      { name: 'desktop', width: 1440, height: 900 },
      { name: 'mobile', width: 390, height: 844 },
    ]) {
      test(`${theme} ${viewport.name} completes the four-step flow`, async ({
        page,
      }, testInfo) => {
        await page.setViewportSize(viewport)
        await configureStablePage(page, {
          theme,
          authenticated: false,
          setupInitialized: false,
        })

        let initialized = false
        await page.route(setupApiPattern, async (route) => {
          if (route.request().method() === 'POST') {
            initialized = true
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ success: true, message: 'ok' }),
            })
            return
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              message: '',
              data: {
                status: initialized,
                root_init: false,
                database_type: 'postgres',
              },
            }),
          })
        })

        await page.goto('/setup', { waitUntil: 'domcontentloaded' })
        await waitForStablePage(page)
        await expect(
          page.getByText('数据库检查', { exact: true })
        ).toBeVisible()
        await page.getByRole('button', { name: '继续' }).click()

        await page.getByLabel('管理员用户名').fill('admin')
        await page.getByLabel('密码', { exact: true }).fill('password123')
        await page.getByLabel('确认密码', { exact: true }).fill('password123')
        await page.getByRole('button', { name: '继续' }).click()
        const externalMode = page.getByRole('radio', { name: /对外运营/ })
        const personalMode = page.getByRole('radio', { name: /个人使用/ })
        await externalMode.focus()
        await externalMode.press('ArrowRight')
        await expect(personalMode).toBeFocused()
        await expect(personalMode).toHaveAttribute('aria-checked', 'true')
        await page.getByRole('button', { name: '继续' }).click()
        await expect(
          page.getByRole('heading', { name: '复核并初始化', exact: true })
        ).toBeVisible()
        await page.screenshot({
          path: testInfo.outputPath(
            `setup-review-${theme}-${viewport.name}.png`
          ),
          fullPage: true,
        })
        await page.getByRole('button', { name: '初始化系统' }).click()
        await expect(page).toHaveURL(/\/$/)
        await assertNoHorizontalOverflow(page)
        await assertInteractiveCentersVisible(page)
      })
    }
  }

  test('shows a retryable error when setup status is unavailable', async ({
    page,
  }) => {
    await configureStablePage(page, {
      theme: 'dark',
      authenticated: false,
      setupInitialized: false,
    })
    await page.route(setupApiPattern, (route) => route.abort())

    await page.goto('/setup', { waitUntil: 'domcontentloaded' })
    await expect(
      page.getByText('暂时无法检查初始化状态', { exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: '重试状态检查' })
    ).toBeVisible()
    await assertNoHorizontalOverflow(page)
  })

  test('retries to setup when the backend is reachable but uninitialized', async ({
    page,
  }) => {
    await configureStablePage(page, {
      theme: 'dark',
      authenticated: false,
      setupInitialized: false,
    })
    let reachable = false
    await page.route(setupApiPattern, (route) => {
      if (!reachable) return route.abort()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            status: false,
            root_init: true,
            database_type: 'sqlite',
          },
        }),
      })
    })

    await page.goto('/console/models', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/setup\/error/)
    reachable = true
    await page.getByRole('button', { name: '重试状态检查' }).click()

    await expect(page).toHaveURL(/\/setup$/)
    await page.getByRole('button', { name: '继续' }).click()
    await expect(page.getByText('复用现有凭据')).toBeVisible()
  })

  test('retries to a safe original target after initialization', async ({
    page,
  }) => {
    await configureStablePage(page, {
      theme: 'dark',
      authenticated: true,
      setupInitialized: true,
    })
    let reachable = false
    await page.route(setupApiPattern, (route) => {
      if (!reachable) return route.abort()
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            status: true,
            root_init: false,
            database_type: '',
          },
        }),
      })
    })

    await page.goto('/console/models', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/setup\/error/)
    reachable = true
    await page.getByRole('button', { name: '重试状态检查' }).click()

    await expect(page).toHaveURL(/\/console\/models$/)
  })
})
