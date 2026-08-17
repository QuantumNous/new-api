import { expect, test } from '@playwright/test'

import {
  assertInteractiveCentersVisible,
  assertNoHorizontalOverflow,
  configureStablePage,
  waitForStablePage,
  type VisualTheme,
} from './fixtures'

async function auditOperationLogs(
  page: Parameters<typeof configureStablePage>[0],
  theme: VisualTheme,
  viewport: 'desktop' | 'mobile'
): Promise<void> {
  await page.setViewportSize(
    viewport === 'desktop'
      ? { width: 1440, height: 900 }
      : { width: 390, height: 844 }
  )
  await configureStablePage(page, { theme, authenticated: true })
  await page.goto('/console/logs/operations', {
    waitUntil: 'domcontentloaded',
  })
  await waitForStablePage(page)

  await expect(page.getByRole('link', { name: '操作日志' })).toHaveAttribute(
    'aria-current',
    'page'
  )
  await expect(
    page
      .getByText('更新用户', { exact: false })
      .filter({ visible: true })
      .first()
  ).toBeVisible()
  await expect(
    page.getByText('失败', { exact: true }).filter({ visible: true }).first()
  ).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await assertInteractiveCentersVisible(page)

  const detailButton = page
    .getByRole('button', { name: '查看详情', exact: true })
    .first()
  await detailButton.click()
  const dialog = page.locator('[role="dialog"][aria-modal="true"]')
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('[data-operation-log-detail]')).toBeVisible()
  await expect(dialog.getByText('203.0.113.25', { exact: true })).toBeVisible()
  await expect(dialog.getByText('访问令牌', { exact: true })).toHaveCount(0)
  await expect(dialog).not.toContainText('password')

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(detailButton).toBeFocused()
}

for (const theme of ['light', 'dark'] as const) {
  for (const viewport of ['desktop', 'mobile'] as const) {
    test(`${theme} ${viewport} operation logs`, async ({ page }) => {
      await auditOperationLogs(page, theme, viewport)
    })
  }
}

test('operation logs expose loading and empty states', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await configureStablePage(page, { theme: 'light', authenticated: true })
  await page.route('**/api/next/admin/operation-logs*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500))
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: '',
        data: { page: 1, page_size: 10, total: 0, items: [] },
      }),
    })
  })

  await page.goto('/console/logs/operations', {
    waitUntil: 'domcontentloaded',
  })
  await expect(page.locator('[aria-busy="true"]:visible').first()).toBeVisible()
  await expect(
    page
      .getByText('暂无操作日志', { exact: true })
      .filter({ visible: true })
      .first()
  ).toBeVisible()
  await assertNoHorizontalOverflow(page)
})

test('operation logs expose a recoverable failure state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await configureStablePage(page, { theme: 'dark', authenticated: true })
  await page.route('**/api/next/admin/operation-logs*', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'audit unavailable' }),
    })
  )

  await page.goto('/console/logs/operations', {
    waitUntil: 'domcontentloaded',
  })
  await expect(
    page.getByText('操作日志加载失败', { exact: true })
  ).toBeVisible()
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible()
  await assertNoHorizontalOverflow(page)
})
