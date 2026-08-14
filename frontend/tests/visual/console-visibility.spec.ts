import { expect, test, type Page } from '@playwright/test'

import {
  assertInteractiveCentersVisible,
  assertNoHorizontalOverflow,
  configureStablePage,
  waitForStablePage,
} from './fixtures'

const hiddenPackageText = /\u5957\u9910/
const onlinePaymentText = /\u5728\u7ebf\u652f\u4ed8/
const viewOrderText = /\u67e5\u770b\u8ba2\u5355/

const order = {
  id: 42,
  order_no: 'topup_visual_42',
  user_id: 1,
  username: 'visual.root',
  email: 'visual-root@ren2hub.dev',
  amount: 20,
  quota: 200_000,
  type: 'topup',
  currency: 'CNY',
  method: 'epay',
  payment_method: 'alipay',
  status: 'completed',
  created: 1_753_600_000,
  paid_at: 1_753_600_030,
}

async function installOrderFixture(page: Page): Promise<void> {
  await page.route(/\/api\/next\/admin\/orders(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: '',
        data: {
          items: [order],
          total: 1,
          page: 1,
          page_size: 20,
          status_counts: { completed: 1, pending: 0, failed: 0 },
          method_counts: { epay: 1 },
          type_counts: { topup: 1 },
          filtered_epay_revenue: 20,
        },
      }),
    })
  )
  await page.route(/\/api\/next\/admin\/orders\/stats(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        message: '',
        data: {
          range: 30,
          generated_at: order.created,
          currency: 'CNY',
          today_revenue: 20,
          today_orders: 1,
          total_revenue: 20,
          total_orders: 1,
          average_amount: 20,
          daily: [{ date: '2026-07-27', revenue: 20, orders: 1 }],
          payment_share: [{ method: 'alipay', amount: 20, count: 1 }],
          top_spenders: [
            {
              user_id: 1,
              username: order.username,
              email: order.email,
              amount: 20,
              orders: 1,
            },
          ],
        },
      }),
    })
  )
}

async function assertNavigationIsHidden(page: Page): Promise<void> {
  const visibleNavigation = page.locator(
    '[data-handdrawn="navigation"]:visible, [data-handdrawn="navigation-strip"]:visible'
  )
  for (const navigation of await visibleNavigation.all()) {
    await expect(navigation).not.toContainText(hiddenPackageText)
  }
  await expect(
    page.locator('a[href="/console/subscription"]:visible')
  ).toHaveCount(0)
  await expect(
    page.locator('a[href="/console/plan-management"]:visible')
  ).toHaveCount(0)
}

for (const scenario of [
  { name: 'dark desktop', theme: 'dark' as const, width: 1440, height: 900 },
  { name: 'light mobile', theme: 'light' as const, width: 390, height: 844 },
]) {
  test(`hides package navigation and generalizes order labels in ${scenario.name}`, async ({
    page,
  }) => {
    await page.setViewportSize({
      width: scenario.width,
      height: scenario.height,
    })
    await configureStablePage(page, {
      theme: scenario.theme,
      authenticated: true,
    })
    await installOrderFixture(page)

    await page.goto('/console/orders', { waitUntil: 'domcontentloaded' })
    await waitForStablePage(page)
    await assertNavigationIsHidden(page)

    await expect(page.locator('body')).not.toContainText(/epay/i)
    await expect(page.locator('body')).toContainText(onlinePaymentText)
    await assertNoHorizontalOverflow(page)
    await assertInteractiveCentersVisible(page)

    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(2)
    await tabs.nth(1).click()
    await waitForStablePage(page)
    await expect(page.locator('body')).not.toContainText(/epay/i)

    const methodFilter = page.getByRole('combobox', {
      name: /\u652f\u4ed8\u670d\u52a1\u5546/,
    })
    await methodFilter.click()
    await expect(
      page.getByRole('option', { name: onlinePaymentText })
    ).toBeVisible()
    await page.getByRole('option', { name: onlinePaymentText }).click()
    await expect(page.locator('body')).not.toContainText(/epay/i)

    await page.getByRole('button', { name: viewOrderText }).first().click()
    const dialog = page.getByRole('dialog', {
      name: /\u8ba2\u5355\u8be6\u60c5/,
    })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(onlinePaymentText)
    await expect(dialog).not.toContainText(/epay/i)
    await dialog.getByRole('button').last().click()

    await page.goto('/console/subscription', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/\/console\/dashboard$/)
    await page.goto('/console/plan-management', {
      waitUntil: 'domcontentloaded',
    })
    await expect(page).toHaveURL(/\/console\/dashboard$/)
    await assertNavigationIsHidden(page)
    await assertNoHorizontalOverflow(page)
  })
}
