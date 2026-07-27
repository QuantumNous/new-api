import { expect, test } from '@playwright/test'

import {
  assertHomeNavbarInitialState,
  configureStablePage,
  freezeAndInspectHomeCanvas,
  waitForStablePage,
  type VisualTheme,
} from './fixtures'

interface Scenario {
  name: string
  path: string
  authenticated?: boolean
  openKeyModal?: boolean
}

const darkScenarios: Scenario[] = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/auth/sign-in', authenticated: false },
  { name: 'dashboard', path: '/console/dashboard' },
  { name: 'keys', path: '/console/keys' },
  { name: 'keys-create-modal', path: '/console/keys', openKeyModal: true },
  { name: 'lab-chat', path: '/lab/chat' },
  { name: 'activity', path: '/console/activity' },
  { name: 'farm', path: '/console/farm' },
]

const lightScenarios: Scenario[] = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/auth/sign-in', authenticated: false },
  { name: 'dashboard', path: '/console/dashboard' },
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

  if (scenario.openKeyModal) {
    const createButton = page.getByRole('button', { name: '创建令牌' })
    await createButton.click()
    expect(runtimeErrors).toEqual([])
    await expect(
      page.locator('[role="dialog"][aria-modal="true"]')
    ).toBeVisible()
  }
  if (scenario.path === '/') {
    await assertHomeNavbarInitialState(page)
    await freezeAndInspectHomeCanvas(page)
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
