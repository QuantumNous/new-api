import { expect, test } from '@playwright/test'

import {
  assertHomeNavbarInitialState,
  assertInteractiveCentersVisible,
  assertNoHorizontalOverflow,
  configureStablePage,
  freezeAndInspectHomeCanvas,
  waitForStablePage,
  type VisualTheme,
} from './fixtures'

interface Scenario {
  name: string
  path: string
  authenticated?: boolean
  /** Accessible name of a button that opens a dialog before the capture. */
  openModalByButton?: string
  /** Accessible name of a dashboard tab selected before the capture. */
  selectTabByName?: string
  /** Opens the first log usage popover before the capture. */
  openUsageDetails?: boolean
  /** Opens the first log detail dialog before the capture. */
  openLogDetails?: boolean
}

const darkScenarios: Scenario[] = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/auth/sign-in', authenticated: false },
  { name: 'dashboard', path: '/console/dashboard' },
  {
    name: 'dashboard-auto-route',
    path: '/console/dashboard',
    selectTabByName: '自动路由',
  },
  { name: 'models', path: '/console/models' },
  { name: 'keys', path: '/console/keys' },
  {
    name: 'keys-create-modal',
    path: '/console/keys',
    openModalByButton: '创建令牌',
  },
  { name: 'subscription', path: '/console/subscription' },
  { name: 'plan-management', path: '/console/plan-management' },
  { name: 'logs', path: '/console/logs' },
  {
    name: 'logs-usage-details',
    path: '/console/logs',
    openUsageDetails: true,
  },
  {
    name: 'logs-detail-dialog',
    path: '/console/logs',
    openLogDetails: true,
  },
  {
    name: 'plan-form-modal',
    path: '/console/plan-management',
    openModalByButton: '新建套餐',
  },
  { name: 'lab-chat', path: '/lab/chat' },
  { name: 'activity', path: '/console/activity' },
  { name: 'farm', path: '/console/farm' },
]

const lightScenarios: Scenario[] = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/auth/sign-in', authenticated: false },
  { name: 'dashboard', path: '/console/dashboard' },
  {
    name: 'dashboard-auto-route',
    path: '/console/dashboard',
    selectTabByName: '自动路由',
  },
  { name: 'models', path: '/console/models' },
  // Both plan surfaces carry new bespoke geometry (storefront cards, ledger
  // rows with disabled row actions), so the pencil rendering is worth pinning.
  { name: 'subscription', path: '/console/subscription' },
  { name: 'plan-management', path: '/console/plan-management' },
  { name: 'logs', path: '/console/logs' },
]

async function captureScenario(
  theme: VisualTheme,
  viewport: 'desktop' | 'mobile',
  scenario: Scenario,
  page: Parameters<typeof configureStablePage>[0]
): Promise<void> {
  const runtimeErrors: string[] = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  await page.setViewportSize(
    viewport === 'desktop'
      ? { width: 1440, height: 900 }
      : { width: 390, height: 844 }
  )
  await configureStablePage(page, {
    theme,
    authenticated: scenario.authenticated ?? true,
  })
  await page.goto(scenario.path, { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  if (scenario.selectTabByName) {
    await page
      .getByRole('tab', { name: scenario.selectTabByName, exact: true })
      .click()
    await waitForStablePage(page)
    await assertNoHorizontalOverflow(page)
    await assertInteractiveCentersVisible(page)
  }

  if (scenario.openModalByButton) {
    await page.getByRole('button', { name: scenario.openModalByButton }).click()
    expect(runtimeErrors).toEqual([])
    await expect(
      page.locator('[role="dialog"][aria-modal="true"]')
    ).toBeVisible()
    // The dialog animates in; settle before pixels are compared.
    await waitForStablePage(page)
  }
  if (scenario.openUsageDetails) {
    const trigger = page.locator('[data-log-usage-trigger]:visible').first()
    await expect(trigger).toBeVisible()
    await trigger.click()
    await expect(page.locator('[data-log-usage-popover]')).toBeVisible()
    await waitForStablePage(page)
  }
  if (scenario.openLogDetails) {
    const trigger = page.locator('[data-log-detail-trigger]:visible').first()
    await expect(trigger).toBeVisible()
    await trigger.click()
    const dialog = page.locator('[role="dialog"][aria-modal="true"]')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('[data-log-detail-empty]')).toBeEmpty()
    await waitForStablePage(page)
  }
  if (scenario.path === '/console/logs') {
    await assertNoHorizontalOverflow(page)
    if (!scenario.openUsageDetails && !scenario.openLogDetails) {
      await assertInteractiveCentersVisible(page)
    }
  }
  if (scenario.path === '/') {
    await assertHomeNavbarInitialState(page)
    await freezeAndInspectHomeCanvas(page)
  }
  if (scenario.path === '/console/dashboard') {
    const brandLinks = page.locator('[data-console-brand-link]')
    await expect(brandLinks).toHaveCount(2)
    await expect(brandLinks.nth(0)).toHaveAttribute('aria-current', 'false')
    await expect(brandLinks.nth(1)).toHaveAttribute('aria-current', 'false')
  }

  await expect(page).toHaveScreenshot(
    `${theme}-${viewport}-${scenario.name}.png`,
    { fullPage: false }
  )
}

for (const scenario of darkScenarios) {
  for (const viewport of ['desktop', 'mobile'] as const) {
    test(`dark ${viewport} ${scenario.name}`, async ({ page }) => {
      await captureScenario('dark', viewport, scenario, page)
    })
  }
}

for (const scenario of lightScenarios) {
  test(`light desktop ${scenario.name}`, async ({ page }) => {
    await captureScenario('light', 'desktop', scenario, page)
  })
}

test('light mobile dashboard-auto-route', async ({ page }) => {
  const scenario = lightScenarios.find(
    (item) => item.name === 'dashboard-auto-route'
  )!
  await captureScenario('light', 'mobile', scenario, page)
})

test('dark wide logs keeps a balanced content width', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 })
  await configureStablePage(page, { theme: 'dark', authenticated: true })
  await page.goto('/console/logs', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  const logPage = page.locator('[data-log-page]')
  await expect(logPage).toBeVisible()
  expect(
    await logPage.evaluate((element) => element.getBoundingClientRect().width)
  ).toBe(1276)
  const detailTrigger = page
    .locator('[data-log-detail-trigger]:visible')
    .first()
  await detailTrigger.hover()
  await expect(detailTrigger).toHaveCSS('text-decoration-line', 'underline')
  await expect(page.locator('[data-log-cost]:visible').first()).toHaveCSS(
    'font-size',
    '14px'
  )
  expect(
    await detailTrigger.evaluate(
      (element) => element.closest('td')?.getBoundingClientRect().width ?? 0
    )
  ).toBeGreaterThan(150)
  await assertNoHorizontalOverflow(page)
  await assertInteractiveCentersVisible(page)
  await expect(page).toHaveScreenshot('dark-wide-logs.png', { fullPage: false })
})

test('dark wide keys matches the balanced content width', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 })
  await configureStablePage(page, { theme: 'dark', authenticated: true })
  await page.goto('/console/keys', { waitUntil: 'domcontentloaded' })
  await waitForStablePage(page)

  const keyPage = page.locator('[data-key-page]')
  await expect(keyPage).toBeVisible()
  expect(
    await keyPage.evaluate((element) => element.getBoundingClientRect().width)
  ).toBe(1276)
  await assertNoHorizontalOverflow(page)
  await assertInteractiveCentersVisible(page)
  await expect(page).toHaveScreenshot('dark-wide-keys.png', { fullPage: false })
})
