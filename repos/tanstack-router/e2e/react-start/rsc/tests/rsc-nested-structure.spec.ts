import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Nested Structure Tests', () => {
  test('Nested renderServerComponent parts render via dot access', async ({
    page,
  }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')

    await expect(page.getByTestId('rsc-nested-renderable-bar')).toBeVisible()
    await expect(
      page.getByTestId('rsc-nested-renderable-bar-content'),
    ).toHaveText('I am foo.bar')

    await expect(page.getByTestId('rsc-nested-renderable-baz')).toBeVisible()
    await expect(
      page.getByTestId('rsc-nested-renderable-baz-content'),
    ).toHaveText('I am baz')
  })

  test('Top-level nested component with children slot renders correctly', async ({
    page,
  }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Verify Header component
    await expect(page.getByTestId('rsc-nested-header')).toBeVisible()
    await expect(page.getByTestId('rsc-header-title')).toContainText(
      'Dashboard Overview',
    )
    await expect(page.getByTestId('rsc-header-timestamp')).toBeVisible()

    // Verify header slot content
    await expect(page.getByTestId('header-slot-content')).toBeVisible()
    await expect(page.getByTestId('header-slot-content')).toContainText(
      'Initial header slot',
    )
  })

  test('Nested component with render prop slot renders correctly', async ({
    page,
  }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Verify Stats component
    await expect(page.getByTestId('rsc-nested-stats')).toBeVisible()
    await expect(page.getByTestId('rsc-stat-views')).toContainText('12,543')
    await expect(page.getByTestId('rsc-stat-likes')).toContainText('847')
    await expect(page.getByTestId('rsc-stat-shares')).toContainText('234')

    // Verify render prop slot with server data
    await expect(page.getByTestId('stats-slot-content')).toBeVisible()
    await expect(page.getByTestId('stats-slot-content')).toContainText(
      'Server total:',
    )
    // Total = 12543 + 847 + 234 = 13624
    await expect(page.getByTestId('stats-computed-value')).toContainText(
      '13624',
    )
  })

  test('Deeply nested component with children slot renders correctly', async ({
    page,
  }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Verify Info component
    await expect(page.getByTestId('rsc-nested-info')).toBeVisible()
    await expect(page.getByTestId('rsc-info-text')).toContainText(
      'content.details.Info',
    )

    // Verify slot content
    await expect(page.getByTestId('info-slot-content')).toBeVisible()
    await expect(page.getByTestId('info-slot-content')).toContainText(
      'Deeply nested client content',
    )
  })

  test('Footer with children and render prop slots renders correctly', async ({
    page,
  }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Verify Footer component
    await expect(page.getByTestId('rsc-nested-footer')).toBeVisible()
    await expect(page.getByTestId('rsc-footer-updated')).toBeVisible()
    await expect(page.getByTestId('rsc-footer-version')).toContainText('v1.0.0')

    // Verify children slot
    await expect(page.getByTestId('footer-slot-content')).toBeVisible()
    await expect(page.getByTestId('footer-slot-content')).toContainText(
      'Initial footer slot',
    )

    // Verify render prop slot with server data
    await expect(page.getByTestId('footer-actions-content')).toBeVisible()
    await expect(page.getByTestId('footer-version-value')).toContainText(
      '1.0.0',
    )
    await expect(page.getByTestId('footer-action-btn')).toBeVisible()
  })

  test('Slot content updates without refetching server component', async ({
    page,
  }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Get initial server timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-header-timestamp')
      .textContent()

    // Verify initial slot content
    await expect(page.getByTestId('header-slot-content')).toContainText(
      'Initial header slot',
    )

    // Update header slot
    await page.getByTestId('update-header-slot-btn').click()
    await page.waitForTimeout(100)

    // Verify slot content updated
    await expect(page.getByTestId('header-slot-content')).toContainText(
      'Header updated at',
    )

    // Verify server timestamp unchanged (no refetch)
    const newTimestamp = await page
      .getByTestId('rsc-header-timestamp')
      .textContent()
    expect(newTimestamp).toBe(initialTimestamp)
  })

  test('Render prop receives server data and updates correctly', async ({
    page,
  }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Initial: 13624 * 1 = 13624
    await expect(page.getByTestId('stats-computed-value')).toContainText(
      '13624',
    )

    // Increase multiplier
    await page.getByTestId('increase-stats-btn').click()
    await page.waitForTimeout(100)

    // 13624 * 2 = 27248
    await expect(page.getByTestId('stats-computed-value')).toContainText(
      '27248',
    )

    // Increase again
    await page.getByTestId('increase-stats-btn').click()
    await page.waitForTimeout(100)

    // 13624 * 3 = 40872
    await expect(page.getByTestId('stats-computed-value')).toContainText(
      '40872',
    )
  })

  test('Nested slot visibility can be toggled', async ({ page }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Initially visible
    await expect(page.getByTestId('info-slot-content')).toBeVisible()

    // Toggle off
    await page.getByTestId('toggle-info-slot-btn').click()
    await page.waitForTimeout(100)
    await expect(page.getByTestId('info-slot-content')).not.toBeVisible()

    // Toggle on
    await page.getByTestId('toggle-info-slot-btn').click()
    await page.waitForTimeout(100)
    await expect(page.getByTestId('info-slot-content')).toBeVisible()
  })

  test('Footer slot updates without refetching server component', async ({
    page,
  }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Get initial server timestamp from footer
    const initialVersion = await page
      .getByTestId('rsc-footer-version')
      .textContent()

    // Verify initial footer slot
    await expect(page.getByTestId('footer-slot-content')).toContainText(
      'Initial footer slot',
    )

    // Update footer slot
    await page.getByTestId('update-footer-slot-btn').click()
    await page.waitForTimeout(100)

    // Verify slot updated
    await expect(page.getByTestId('footer-slot-content')).toContainText(
      'Footer updated at',
    )

    // Verify server content unchanged
    const newVersion = await page
      .getByTestId('rsc-footer-version')
      .textContent()
    expect(newVersion).toBe(initialVersion)
  })

  test('Nested structure with slots works after client-side navigation', async ({
    page,
  }) => {
    // Start from home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate via nav link
    await page.getByTestId('nav-nested-structure').click()
    await page.waitForURL('/rsc-nested-structure')

    // Verify all nested components rendered
    await expect(page.getByTestId('rsc-nested-header')).toBeVisible()
    await expect(page.getByTestId('rsc-nested-stats')).toBeVisible()
    await expect(page.getByTestId('rsc-nested-info')).toBeVisible()
    await expect(page.getByTestId('rsc-nested-footer')).toBeVisible()

    // Verify slot content rendered
    await expect(page.getByTestId('header-slot-content')).toBeVisible()
    await expect(page.getByTestId('stats-slot-content')).toBeVisible()
    await expect(page.getByTestId('info-slot-content')).toBeVisible()
    await expect(page.getByTestId('footer-slot-content')).toBeVisible()
    await expect(page.getByTestId('footer-actions-content')).toBeVisible()
  })
})

test.describe('RSC Destructured Access Tests', () => {
  test('Destructured components render correctly', async ({ page }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Verify destructured Header
    await expect(page.getByTestId('rsc-destructured-header')).toBeVisible()
    await expect(page.getByTestId('rsc-destructured-timestamp')).toBeVisible()

    // Verify destructured Content
    await expect(page.getByTestId('rsc-destructured-content')).toBeVisible()

    // Verify destructured Footer
    await expect(page.getByTestId('rsc-destructured-footer')).toBeVisible()
  })

  test('Destructured component children slot renders correctly', async ({
    page,
  }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Verify header slot
    await expect(page.getByTestId('destructured-header-slot')).toBeVisible()
    await expect(page.getByTestId('destructured-header-slot')).toContainText(
      'Initial destructured slot',
    )

    // Verify footer slot
    await expect(page.getByTestId('destructured-footer-slot')).toBeVisible()
    await expect(page.getByTestId('destructured-footer-slot')).toContainText(
      'Footer via destructuring',
    )
  })

  test('Destructured component render prop receives server data', async ({
    page,
  }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Verify render prop slot with server data (count = 42)
    await expect(page.getByTestId('destructured-content-slot')).toBeVisible()
    await expect(page.getByTestId('destructured-content-slot')).toContainText(
      'Server count: 42',
    )
    // Initial: 42 * 1 = 42
    await expect(page.getByTestId('destructured-computed-value')).toContainText(
      '42',
    )
  })

  test('Destructured component slot updates without refetching', async ({
    page,
  }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Get initial timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-destructured-timestamp')
      .textContent()

    // Verify initial slot content
    await expect(page.getByTestId('destructured-header-slot')).toContainText(
      'Initial destructured slot',
    )

    // Update slot
    await page.getByTestId('update-destructured-slot-btn').click()
    await page.waitForTimeout(100)

    // Verify slot updated
    await expect(page.getByTestId('destructured-header-slot')).toContainText(
      'Destructured updated at',
    )

    // Verify server timestamp unchanged (no refetch)
    const newTimestamp = await page
      .getByTestId('rsc-destructured-timestamp')
      .textContent()
    expect(newTimestamp).toBe(initialTimestamp)
  })

  test('Destructured component render prop updates correctly', async ({
    page,
  }) => {
    await page.goto('/rsc-nested-structure')
    await page.waitForURL('/rsc-nested-structure')
    await waitForHydration(page)

    // Initial: 42 * 1 = 42
    await expect(page.getByTestId('destructured-computed-value')).toContainText(
      '42',
    )

    // Increase multiplier
    await page.getByTestId('increase-badge-btn').click()
    await page.waitForTimeout(100)

    // 42 * 2 = 84
    await expect(page.getByTestId('destructured-computed-value')).toContainText(
      '84',
    )

    // Increase again
    await page.getByTestId('increase-badge-btn').click()
    await page.waitForTimeout(100)

    // 42 * 3 = 126
    await expect(page.getByTestId('destructured-computed-value')).toContainText(
      '126',
    )
  })
})
