import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Param - no remount / state preserved', () => {
  test('full load hydrates without mismatch', async ({ page }) => {
    await page.goto('/rsc-param/bravo')
    await page.waitForURL('/rsc-param/bravo')

    await expect(page.getByTestId('rsc-param-page')).toBeVisible()
    await expect(page.getByTestId('rsc-param-renderable-id')).toContainText(
      'id: bravo',
    )
    await expect(page.getByTestId('rsc-param-composite-id')).toContainText(
      'id: bravo',
    )

    await waitForHydration(page)
    await page.getByTestId('rsc-param-direct-inc').click()
    await expect(page.getByTestId('rsc-param-direct-count')).toHaveText('1')
  })

  test('navigating between params keeps client instances and state', async ({
    page,
  }) => {
    const logs: Array<string> = []
    page.on('console', (msg) => logs.push(msg.text()))

    await page.goto('/rsc-param/alpha')
    await page.waitForURL('/rsc-param/alpha')
    await waitForHydration(page)

    await expect(page.getByTestId('rsc-param-renderable-id')).toContainText(
      'id: alpha',
    )
    await expect(page.getByTestId('rsc-param-composite-id')).toContainText(
      'id: alpha',
    )

    // Set local state in all client components
    await page.getByTestId('rsc-param-direct-inc').click()
    await page.getByTestId('rsc-param-slot-child-input').fill('persisted-text')
    await page.getByTestId('rsc-param-slot-render-prop-toggle').check()

    await expect(page.getByTestId('rsc-param-direct-count')).toHaveText('1')
    await expect(page.getByTestId('rsc-param-slot-child-value')).toHaveText(
      'persisted-text',
    )
    await expect(
      page.getByTestId('rsc-param-slot-render-prop-value'),
    ).toHaveText('true')

    const directInstanceBefore = await page
      .getByTestId('rsc-param-direct-instance')
      .textContent()
    const slotChildInstanceBefore = await page
      .getByTestId('rsc-param-slot-child-instance')
      .textContent()
    const slotFooterInstanceBefore = await page
      .getByTestId('rsc-param-slot-render-prop-instance')
      .textContent()

    const logsBefore = logs.length

    await page.getByTestId('rsc-param-next-link').click()
    await page.waitForURL('/rsc-param/bravo')

    await expect(page.getByTestId('rsc-param-renderable-id')).toContainText(
      'id: bravo',
    )
    await expect(page.getByTestId('rsc-param-composite-id')).toContainText(
      'id: bravo',
    )

    // Assert client state preserved
    await expect(page.getByTestId('rsc-param-direct-count')).toHaveText('1')
    await expect(page.getByTestId('rsc-param-slot-child-value')).toHaveText(
      'persisted-text',
    )
    await expect(
      page.getByTestId('rsc-param-slot-render-prop-value'),
    ).toHaveText('true')

    // Assert no remount (instance ids stable)
    await expect(page.getByTestId('rsc-param-direct-instance')).toHaveText(
      directInstanceBefore ?? '',
    )
    await expect(page.getByTestId('rsc-param-slot-child-instance')).toHaveText(
      slotChildInstanceBefore ?? '',
    )
    await expect(
      page.getByTestId('rsc-param-slot-render-prop-instance'),
    ).toHaveText(slotFooterInstanceBefore ?? '')

    const newLogs = logs.slice(logsBefore)
    expect(
      newLogs.some((l) => l.includes('[unmount] ClientRenderedDirect')),
    ).toBe(false)
    expect(newLogs.some((l) => l.includes('[unmount] SlotChild'))).toBe(false)
    expect(newLogs.some((l) => l.includes('[unmount] SlotRenderProp'))).toBe(
      false,
    )

    // If any mount logs happened after nav, treat as remount
    expect(
      newLogs.some((l) => l.includes('[mount] ClientRenderedDirect')),
    ).toBe(false)
    expect(newLogs.some((l) => l.includes('[mount] SlotChild'))).toBe(false)
    expect(newLogs.some((l) => l.includes('[mount] SlotRenderProp'))).toBe(
      false,
    )
  })
})
