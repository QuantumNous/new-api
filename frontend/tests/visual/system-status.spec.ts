import { expect, test, type Page, type Route } from '@playwright/test'

import {
  assertInteractiveCentersVisible,
  assertNoHorizontalOverflow,
  configureStablePage,
  waitForStablePage,
} from './fixtures'

const completeStatus = {
  status: 'online',
  scope: 'current_node',
  sampled_at: 1_786_700_000,
  cpu_percent: 34.2,
  memory_used_bytes: 5_583_457_484,
  memory_total_bytes: 17_179_869_184,
  disk_used_bytes: 234_075_717_632,
  disk_total_bytes: 549_755_813_888,
  network_tx_bytes_per_second: 2_202_000,
  network_rx_bytes_per_second: 13_002_300,
  network_series: [
    {
      timestamp: 1_786_699_995,
      tx_bytes_per_second: 1_800_000,
      rx_bytes_per_second: 11_000_000,
    },
    {
      timestamp: 1_786_700_000,
      tx_bytes_per_second: 2_202_000,
      rx_bytes_per_second: 13_002_300,
    },
  ],
  api_success_rate_24h: 99.7,
  version: 'v1.0.0-rc.23-visual',
}

function fulfillSystem(route: Route, data = completeStatus): Promise<void> {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ success: true, message: '', data }),
  })
}

async function openDashboard(page: Page): Promise<void> {
  await page.goto('/console/dashboard', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)
}

test('renders complete online metrics on dark desktop', async ({ page }) => {
  await configureStablePage(page, { theme: 'dark', authenticated: true })
  await page.route('**/api/next/dashboard/system', (route) =>
    fulfillSystem(route)
  )
  await openDashboard(page)

  const card = page.locator('[data-system-status-card]')
  await card.scrollIntoViewIfNeeded()
  await expect(card.locator('[data-service-state]')).toHaveAttribute(
    'data-service-state',
    'online'
  )
  await expect(card).toContainText('ONLINE')
  await expect(card).toContainText('5.2 / 16')
  await expect(card).toContainText('2.20')
  await expect(card).toContainText('13.00')
  await expect(card).toContainText('99.7%')
  await expect(card).toContainText('v1.0.0-rc.23-visual')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await assertNoHorizontalOverflow(page)
  await assertInteractiveCentersVisible(page)
})

test('renders degraded partial metrics on light mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await configureStablePage(page, { theme: 'light', authenticated: true })
  await page.route('**/api/next/dashboard/system', (route) =>
    fulfillSystem(route, {
      ...completeStatus,
      status: 'degraded',
      cpu_percent: null,
      network_tx_bytes_per_second: null,
      network_rx_bytes_per_second: null,
      api_success_rate_24h: null,
      network_series: [],
    })
  )
  await openDashboard(page)

  const card = page.locator('[data-system-status-card]')
  await card.scrollIntoViewIfNeeded()
  await expect(card.locator('[data-service-state]')).toHaveAttribute(
    'data-service-state',
    'degraded'
  )
  await expect(card).toContainText('降级')
  await expect(card).toContainText('--')
  await expect(card).toContainText('5.2 / 16')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await assertNoHorizontalOverflow(page)
  await assertInteractiveCentersVisible(page)
})

test('renders offline placeholders when the first request fails', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await configureStablePage(page, { theme: 'dark', authenticated: true })
  await page.route('**/api/next/dashboard/system', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ success: false, message: 'unavailable' }),
    })
  )
  await openDashboard(page)

  const card = page.locator('[data-system-status-card]')
  await card.scrollIntoViewIfNeeded()
  await expect(card.locator('[data-service-state]')).toHaveAttribute(
    'data-service-state',
    'offline'
  )
  await expect(card).toContainText('OFFLINE')
  await expect(card).toContainText('--')
  await assertNoHorizontalOverflow(page)
})

test('keeps the first-load card stable while metrics are pending', async ({
  page,
}) => {
  await configureStablePage(page, { theme: 'light', authenticated: true })
  let releaseRequest!: () => void
  const requestReleased = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  await page.route('**/api/next/dashboard/system', async (route) => {
    await requestReleased
    await fulfillSystem(route)
  })
  await openDashboard(page)

  const card = page.locator('[data-system-status-card]')
  await card.scrollIntoViewIfNeeded()
  await expect(card.locator('[data-service-state]')).toHaveAttribute(
    'data-service-state',
    'offline'
  )
  await expect(card).toContainText('--')
  await expect(card).toBeVisible()

  releaseRequest()
  await expect(card.locator('[data-service-state]')).toHaveAttribute(
    'data-service-state',
    'online'
  )
})
