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
  { name: 'keys', path: '/console/keys' },
  {
    name: 'keys-create-modal',
    path: '/console/keys',
    openModalByButton: '创建令牌',
  },
  { name: 'subscription', path: '/console/subscription' },
  { name: 'plan-management', path: '/console/plan-management' },
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
  // Both plan surfaces carry new bespoke geometry (storefront cards, ledger
  // rows with disabled row actions), so the pencil rendering is worth pinning.
  { name: 'subscription', path: '/console/subscription' },
  { name: 'plan-management', path: '/console/plan-management' },
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
