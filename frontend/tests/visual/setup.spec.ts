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
      { name: 'wide', width: 2048, height: 1152 },
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

        const navigationBox = await page
          .locator('[data-setup-navigation]')
          .boundingBox()
        const navigationInnerBox = await page
          .locator('[data-setup-navigation-inner]')
          .boundingBox()
        const contentBox = await page
          .locator('[data-setup-content]')
          .boundingBox()
        expect(navigationBox).not.toBeNull()
        expect(navigationInnerBox).not.toBeNull()
        expect(contentBox).not.toBeNull()

        const expectedNavigationWidth =
          theme === 'dark' ? viewport.width : Math.min(viewport.width, 1200)
        expect(navigationBox!.width).toBeCloseTo(expectedNavigationWidth, 0)
        expect(navigationBox!.x).toBeCloseTo(
          (viewport.width - expectedNavigationWidth) / 2,
          0
        )
        expect(navigationInnerBox!.width).toBeLessThanOrEqual(
          theme === 'dark' ? Math.min(viewport.width, 1440) : 1200
        )
        expect(contentBox!.width).toBeLessThanOrEqual(
          theme === 'dark' ? Math.min(viewport.width, 1440) : 1200
        )

        await expect(
          page.getByText('数据库检查', { exact: true })
        ).toBeVisible()
        await page.getByRole('button', { name: '继续' }).click()

        const username = page.locator('#setup-username')
        const password = page.locator('#setup-password')
        const confirmPassword = page.locator('#setup-confirm-password')
        const passwordToggle = page
          .locator('[data-setup-password-toggle]')
          .first()

        const inputMetrics = await username.evaluate((element) => {
          const style = getComputedStyle(element)
          return {
            height: element.getBoundingClientRect().height,
            paddingLeft: Number.parseFloat(style.paddingLeft),
            fontSize: Number.parseFloat(style.fontSize),
            lineHeight: Number.parseFloat(style.lineHeight),
          }
        })
        expect(inputMetrics).toEqual({
          height: 44,
          paddingLeft: 16,
          fontSize: 15,
          lineHeight: 22,
        })

        await page.getByRole('button', { name: '继续' }).click()
        await expect(username).toHaveAttribute('aria-invalid', 'true')
        await page.getByRole('button', { name: '返回' }).click()
        await page.getByRole('button', { name: '继续' }).click()
        await expect(username).toHaveAttribute('aria-invalid', 'false')

        await username.fill('admin')
        await password.fill('password123')
        await confirmPassword.fill('password123')

        const passwordMetrics = await password.evaluate((element) => {
          const style = getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          return {
            paddingRight: Number.parseFloat(style.paddingRight),
            rect: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
          }
        })
        const passwordToggleBox = await passwordToggle.boundingBox()
        expect(passwordMetrics.paddingRight).toBeGreaterThanOrEqual(48)
        expect(passwordToggleBox).not.toBeNull()
        expect(passwordToggleBox!.x).toBeGreaterThan(passwordMetrics.rect.x)
        expect(passwordToggleBox!.x + passwordToggleBox!.width).toBeLessThan(
          passwordMetrics.rect.x + passwordMetrics.rect.width
        )
        expect(passwordToggleBox!.y).toBeGreaterThan(passwordMetrics.rect.y)
        expect(passwordToggleBox!.y + passwordToggleBox!.height).toBeLessThan(
          passwordMetrics.rect.y + passwordMetrics.rect.height
        )

        await expect(password).toHaveAttribute('type', 'password')
        await passwordToggle.click()
        await expect(password).toHaveAttribute('type', 'text')

        if (theme === 'dark') {
          await username.evaluate((element) => element.blur())
          const restBackground = await username.evaluate(
            (element) => getComputedStyle(element).backgroundColor
          )
          await username.hover()
          const hoverBackground = await username.evaluate(
            (element) => getComputedStyle(element).backgroundColor
          )
          await username.focus()
          const focusBackground = await username.evaluate(
            (element) => getComputedStyle(element).backgroundColor
          )
          expect(hoverBackground).toBe(restBackground)
          expect(focusBackground).toBe(restBackground)
        }

        const wizardBox = await page
          .locator('[data-setup-wizard]')
          .boundingBox()
        expect(wizardBox).not.toBeNull()
        expect(wizardBox!.width).toBeLessThanOrEqual(
          theme === 'dark' ? 1200 : 1100
        )

        await page.screenshot({
          path: testInfo.outputPath(
            `setup-account-${theme}-${viewport.name}.png`
          ),
          fullPage: true,
        })

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
    const navigationBox = await page
      .locator('[data-setup-navigation]')
      .boundingBox()
    expect(navigationBox).not.toBeNull()
    expect(navigationBox!.x).toBeCloseTo(0, 0)
    expect(navigationBox!.width).toBeCloseTo(page.viewportSize()!.width, 0)
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
