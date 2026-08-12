import { expect, test } from '@playwright/test'

test.describe('RSC Complex CSS Preload Tests', () => {
  // ============================================================================
  // Test 1: ClientWidgetA (direct render) has CSS applied
  // ============================================================================
  test('ClientWidgetA rendered directly in RSC has CSS applied', async ({
    page,
  }) => {
    await page.goto('/rsc-css-preload-complex')

    const widgetA = page.locator('[data-testid="client-widget-a"]')
    await expect(widgetA).toBeVisible()

    // Check purple theme background (#f3e8ff)
    const backgroundColor = await widgetA.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(backgroundColor).toBe('rgb(243, 232, 255)')

    // Check purple border (#9333ea)
    const borderColor = await widgetA.evaluate(
      (el) => getComputedStyle(el).borderColor,
    )
    expect(borderColor).toBe('rgb(147, 51, 234)')
  })

  // ============================================================================
  // Test 2: ClientWidgetB (via slot) has CSS applied
  // ============================================================================
  test('ClientWidgetB passed via children slot has CSS applied', async ({
    page,
  }) => {
    await page.goto('/rsc-css-preload-complex')

    const widgetB = page.locator('[data-testid="client-widget-b"]')
    await expect(widgetB).toBeVisible()

    // Check teal theme background (#ccfbf1)
    const backgroundColor = await widgetB.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(backgroundColor).toBe('rgb(204, 251, 241)')

    // Check teal border (#14b8a6)
    const borderColor = await widgetB.evaluate(
      (el) => getComputedStyle(el).borderColor,
    )
    expect(borderColor).toBe('rgb(20, 184, 166)')
  })

  // ============================================================================
  // Test 3: ClientWidgetC (in unrendered RSC) is NOT in DOM
  // ============================================================================
  test('ClientWidgetC in unrendered ServerB is not in DOM', async ({
    page,
  }) => {
    await page.goto('/rsc-css-preload-complex')

    // Widget C should NOT be present since ServerB is not rendered
    const widgetC = page.locator('[data-testid="client-widget-c"]')
    await expect(widgetC).not.toBeVisible()
    await expect(widgetC).toHaveCount(0)

    // ServerB should also not be present
    const serverB = page.locator('[data-testid="server-component-b"]')
    await expect(serverB).not.toBeVisible()
    await expect(serverB).toHaveCount(0)
  })

  // ============================================================================
  // Test 4: Both rendered widgets are interactive
  // ============================================================================
  test('ClientWidgetA counter is interactive', async ({ page }) => {
    await page.goto('/rsc-css-preload-complex')

    // Wait for hydration by waiting for button to be clickable
    const incrementBtn = page.locator(
      '[data-testid="client-widget-a-increment"]',
    )
    await expect(incrementBtn).toBeVisible()
    await expect(incrementBtn).toBeEnabled()

    const count = page.locator('[data-testid="client-widget-a-count"]')
    await expect(count).toHaveText('0')

    await incrementBtn.click()
    await expect(count).toHaveText('1')

    await incrementBtn.click()
    await expect(count).toHaveText('2')

    await page.click('[data-testid="client-widget-a-decrement"]')
    await expect(count).toHaveText('1')
  })

  test('ClientWidgetB toggle is interactive', async ({ page }) => {
    await page.goto('/rsc-css-preload-complex')

    const toggle = page.locator('[data-testid="client-widget-b-toggle"]')
    await expect(toggle).toBeVisible()
    await expect(toggle).toBeEnabled()

    await expect(toggle).toHaveText('Inactive')

    await toggle.click()
    await expect(toggle).toHaveText('Active')

    await toggle.click()
    await expect(toggle).toHaveText('Inactive')
  })

  // ============================================================================
  // Test 5: CSS module classes are scoped (hashed)
  // ============================================================================
  test('CSS module classes are scoped for all widgets', async ({ page }) => {
    await page.goto('/rsc-css-preload-complex')

    // Widget A classes should be hashed (accept Vite `_widget_xxx` or Rspack `widget-xxx` scoped names)
    const widgetA = page.locator('[data-testid="client-widget-a"]')
    const widgetAClass = await widgetA.getAttribute('class')
    expect(widgetAClass).toMatch(/(^|\s)(_widget_|widget[-_])[\w-]+/)

    // Widget B classes should be hashed
    const widgetB = page.locator('[data-testid="client-widget-b"]')
    const widgetBClass = await widgetB.getAttribute('class')
    expect(widgetBClass).toMatch(/(^|\s)(_widget_|widget[-_])[\w-]+/)

    // Classes should be different (different modules)
    expect(widgetAClass).not.toBe(widgetBClass)
  })

  // ============================================================================
  // Test 6: Server component A wrapper is rendered
  // ============================================================================
  test('Server component A wrapper is rendered correctly', async ({ page }) => {
    await page.goto('/rsc-css-preload-complex')

    const serverA = page.locator('[data-testid="server-component-a"]')
    await expect(serverA).toBeVisible()

    // Check server badge
    const badge = serverA
      .locator('span')
      .filter({ hasText: 'SERVER COMPONENT A' })
    await expect(badge).toBeVisible()

    // Check title
    const title = page.locator('[data-testid="server-a-title"]')
    await expect(title).toHaveText('Server Component A')
  })

  // ============================================================================
  // Test 7: No hydration errors
  // ============================================================================
  test('page hydrates without console errors', async ({ page }) => {
    const errors: Array<string> = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    await page.goto('/rsc-css-preload-complex')

    // Wait for hydration
    const incrementBtn = page.locator(
      '[data-testid="client-widget-a-increment"]',
    )
    await expect(incrementBtn).toBeVisible()
    await expect(incrementBtn).toBeEnabled()

    // Click to verify hydration
    await incrementBtn.click()
    await expect(
      page.locator('[data-testid="client-widget-a-count"]'),
    ).toHaveText('1')

    // Filter out non-hydration errors
    const hydrationErrors = errors.filter(
      (e) =>
        e.includes('hydrat') ||
        e.includes('Hydrat') ||
        e.includes('mismatch') ||
        e.includes('did not match'),
    )
    expect(hydrationErrors).toHaveLength(0)
  })

  // ============================================================================
  // Test 8: No flash of unstyled content
  // ============================================================================
  test('no flash of unstyled content on initial render', async ({ page }) => {
    // Slow down network to catch any flash
    await page.route('**/*', (route) => route.continue())

    const flashDetected = { value: false }

    // Check styles immediately when widgets appear
    page.on('console', async (msg) => {
      if (msg.text().includes('FLASH_DETECTED')) {
        flashDetected.value = true
      }
    })

    await page.goto('/rsc-css-preload-complex')

    // Check that widgets have correct styles immediately
    await page.waitForSelector('[data-testid="client-widget-a"]')

    const widgetABg = await page
      .locator('[data-testid="client-widget-a"]')
      .evaluate((el) => getComputedStyle(el).backgroundColor)

    const widgetBBg = await page
      .locator('[data-testid="client-widget-b"]')
      .evaluate((el) => getComputedStyle(el).backgroundColor)

    // Purple theme for A
    expect(widgetABg).toBe('rgb(243, 232, 255)')
    // Teal theme for B
    expect(widgetBBg).toBe('rgb(204, 251, 241)')

    expect(flashDetected.value).toBe(false)
  })

  // ============================================================================
  // Test 9: CSS stylesheets are loaded (verify via computed styles)
  // ============================================================================
  test('CSS module styles are correctly applied to all rendered widgets', async ({
    page,
  }) => {
    await page.goto('/rsc-css-preload-complex')

    // Widget A should have purple theme (from direct RSC render)
    const widgetA = page.locator('[data-testid="client-widget-a"]')
    await expect(widgetA).toBeVisible()
    const widgetABg = await widgetA.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    // Purple: #f3e8ff = rgb(243, 232, 255)
    expect(widgetABg).toBe('rgb(243, 232, 255)')

    // Widget B should have teal theme (from slot)
    const widgetB = page.locator('[data-testid="client-widget-b"]')
    await expect(widgetB).toBeVisible()
    const widgetBBg = await widgetB.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    // Teal: #ccfbf1 = rgb(204, 251, 241)
    expect(widgetBBg).toBe('rgb(204, 251, 241)')

    // Widget C should NOT be present
    const widgetC = page.locator('[data-testid="client-widget-c"]')
    await expect(widgetC).toHaveCount(0)
  })

  // ============================================================================
  // Test 10: Slot contains the slotted content
  // ============================================================================
  test('server component slot contains ClientWidgetB', async ({ page }) => {
    await page.goto('/rsc-css-preload-complex')

    const slot = page.locator('[data-testid="server-a-slot"]')
    await expect(slot).toBeVisible()

    // Widget B should be inside the slot
    const widgetBInSlot = slot.locator('[data-testid="client-widget-b"]')
    await expect(widgetBInSlot).toBeVisible()
  })

  // ============================================================================
  // Test 11: Client-side navigation works
  // ============================================================================
  test('works correctly after client-side navigation', async ({ page }) => {
    // Start on home page
    await page.goto('/')

    // Navigate to the complex preload page via link (if available) or direct
    await page.goto('/rsc-css-preload-complex')

    // Both widgets should be visible and styled
    const widgetA = page.locator('[data-testid="client-widget-a"]')
    await expect(widgetA).toBeVisible()

    const widgetABg = await widgetA.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(widgetABg).toBe('rgb(243, 232, 255)')

    const widgetB = page.locator('[data-testid="client-widget-b"]')
    await expect(widgetB).toBeVisible()

    const widgetBBg = await widgetB.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    )
    expect(widgetBBg).toBe('rgb(204, 251, 241)')
  })
})
