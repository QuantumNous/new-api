import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

type Point = {
  x: number
  y: number
}

// This warning can occur during rapid navigation/hydration cycles and doesn't affect functionality
// It's a React development mode warning about async state updates during mounting
test.use({
  whitelistErrors: [
    "Can't perform a React state update on a component that hasn't mounted yet",
  ],
})

test.describe('RSC SSR False Tests - Both loader and component on client', () => {
  // Helper to clear localStorage and get a fresh start
  async function clearDrawingStorage(page: any) {
    await page.evaluate(() => {
      localStorage.removeItem('drawing-name')
      localStorage.removeItem('drawing-last-color')
      localStorage.removeItem('drawing-canvas-data')
      localStorage.removeItem('drawing-stroke-count')
    })
  }

  async function drawStroke(page: any, start: Point, end: Point) {
    await page.getByTestId('drawing-canvas').evaluate(
      (
        canvas: HTMLCanvasElement,
        { start, end }: { start: Point; end: Point },
      ) => {
        const rect = canvas.getBoundingClientRect()

        const createMouseEvent = (type: string, point: Point) =>
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + point.x,
            clientY: rect.top + point.y,
          })

        canvas.dispatchEvent(createMouseEvent('mousedown', start))
        canvas.dispatchEvent(createMouseEvent('mousemove', start))
        canvas.dispatchEvent(createMouseEvent('mousemove', end))
        canvas.dispatchEvent(createMouseEvent('mouseup', end))
      },
      { start, end },
    )
  }

  test('Page renders with RSC content after initial client load', async ({
    page,
  }) => {
    // Go to home first to clear any state, then navigate
    await page.goto('/')
    await clearDrawingStorage(page)
    await page.goto('/rsc-ssr-false')
    await page.waitForURL('/rsc-ssr-false')

    // Wait for content to appear (both loader and component run on client)
    await expect(page.getByTestId('rsc-ssr-false-content')).toBeVisible({
      timeout: 5000,
    })

    // Verify page title
    await expect(page.getByTestId('rsc-ssr-false-title')).toHaveText(
      'Drawing Canvas (SSR: false)',
    )
  })

  test('RSC server tools configuration is visible', async ({ page }) => {
    await page.goto('/rsc-ssr-false')
    await page.waitForURL('/rsc-ssr-false')

    await expect(page.getByTestId('rsc-ssr-false-content')).toBeVisible({
      timeout: 5000,
    })

    // Verify server-rendered tools info
    await expect(page.getByTestId('rsc-drawing-title')).toContainText(
      'Drawing Canvas',
    )
    await expect(page.getByTestId('brush-count')).toContainText('4 sizes')
    await expect(page.getByTestId('color-count')).toContainText('5 colors')
    await expect(page.getByTestId('canvas-size')).toContainText('400x200')

    // Verify server timestamp is present
    const timestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()
    expect(timestamp).toContain('Loaded:')
  })

  test('Canvas is rendered and visible', async ({ page }) => {
    await page.goto('/rsc-ssr-false')
    await page.waitForURL('/rsc-ssr-false')
    await waitForHydration(page)

    // Verify canvas container
    await expect(page.getByTestId('canvas-container')).toBeVisible()

    // Verify canvas element exists
    await expect(page.getByTestId('drawing-canvas')).toBeVisible()
  })

  test('Brush size selection works', async ({ page }) => {
    await page.goto('/rsc-ssr-false')
    await page.waitForURL('/rsc-ssr-false')
    await waitForHydration(page)

    await expect(page.getByTestId('canvas-container')).toBeVisible()

    // Click different brush sizes
    await page.getByTestId('brush-2').click()
    await page.getByTestId('brush-10').click()
    await page.getByTestId('brush-20').click()
    await page.getByTestId('brush-5').click()

    // Buttons should be clickable without error
    await expect(page.getByTestId('brush-5')).toBeVisible()
  })

  test('Color selection works', async ({ page }) => {
    await page.goto('/rsc-ssr-false')
    await page.waitForURL('/rsc-ssr-false')
    await waitForHydration(page)

    await expect(page.getByTestId('canvas-container')).toBeVisible()

    // Click different colors
    await page.getByTestId('color-blue').click()
    await page.getByTestId('color-green').click()
    await page.getByTestId('color-red').click()
    await page.getByTestId('color-purple').click()
    await page.getByTestId('color-black').click()

    // Buttons should be clickable without error
    await expect(page.getByTestId('color-black')).toBeVisible()
  })

  test('Drawing on canvas updates stroke count', async ({ page }) => {
    await page.goto('/rsc-ssr-false')
    await page.waitForURL('/rsc-ssr-false')
    await waitForHydration(page)

    await expect(page.getByTestId('canvas-container')).toBeVisible()

    // Draw a stroke
    await drawStroke(page, { x: 50, y: 50 }, { x: 150, y: 100 })

    // Verify stroke count increased
    await expect(page.getByTestId('canvas-container')).toContainText(
      'Strokes: 1',
    )

    // Draw another stroke
    await drawStroke(page, { x: 100, y: 30 }, { x: 200, y: 80 })

    // Verify stroke count increased again
    await expect(page.getByTestId('canvas-container')).toContainText(
      'Strokes: 2',
    )
  })

  test('Clear canvas button works', async ({ page }) => {
    await page.goto('/rsc-ssr-false')
    await page.waitForURL('/rsc-ssr-false')
    await waitForHydration(page)

    await expect(page.getByTestId('canvas-container')).toBeVisible()

    // Draw a stroke
    await drawStroke(page, { x: 50, y: 50 }, { x: 150, y: 100 })

    // Verify stroke was recorded
    await expect(page.getByTestId('canvas-container')).toContainText(
      'Strokes: 1',
    )

    // Clear canvas
    await page.getByTestId('clear-canvas-btn').click()

    // Verify stroke count reset
    await expect(page.getByTestId('canvas-container')).toContainText(
      'Strokes: 0',
    )
  })

  test('Save controls are visible and functional', async ({ page }) => {
    await page.goto('/rsc-ssr-false')
    await page.waitForURL('/rsc-ssr-false')
    await waitForHydration(page)

    // Verify save controls section exists
    await expect(page.getByTestId('save-controls')).toBeVisible()

    // Verify input and button exist
    await expect(page.getByTestId('drawing-name-input')).toBeVisible()
    await expect(page.getByTestId('save-drawing-btn')).toBeVisible()

    // Initial name should be "Untitled" or whatever was saved
    const initialName = await page.getByTestId('current-name').textContent()
    expect(initialName).toBeTruthy()

    // Change the name
    await page.getByTestId('drawing-name-input').fill('My Masterpiece')
    await page.getByTestId('save-drawing-btn').click()

    // Verify name updated
    await expect(page.getByTestId('current-name')).toContainText(
      'My Masterpiece',
    )
  })

  test('RSC timestamp remains stable during client interactions', async ({
    page,
  }) => {
    await page.goto('/rsc-ssr-false')
    await page.waitForURL('/rsc-ssr-false')
    await waitForHydration(page)

    await expect(page.getByTestId('rsc-ssr-false-content')).toBeVisible()

    // Get initial RSC timestamp
    const initialTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()

    // Perform multiple client interactions
    await page.getByTestId('brush-10').click()
    await page.getByTestId('color-blue').click()
    await page.getByTestId('brush-20').click()
    await page.getByTestId('color-red').click()
    await page.getByTestId('clear-canvas-btn').click()

    // Verify RSC timestamp is unchanged
    const newTimestamp = await page
      .getByTestId('rsc-server-timestamp')
      .textContent()
    expect(newTimestamp).toBe(initialTimestamp)
  })

  test('Page works correctly after client-side navigation', async ({
    page,
  }) => {
    // Start at home
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate to the page via nav bar
    await page.getByTestId('nav-ssr-false').click()
    await page.waitForURL('/rsc-ssr-false')

    // Verify content loads after client-side navigation
    await expect(page.getByTestId('rsc-ssr-false-content')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('canvas-container')).toBeVisible()
    await expect(page.getByTestId('drawing-canvas')).toBeVisible()

    // Verify interactivity works
    await page.getByTestId('color-green').click()
    await page.getByTestId('brush-10').click()
  })

  test('LocalStorage persistence works across page visits', async ({
    page,
  }) => {
    // First visit - clear any previous state and save a name
    await page.goto('/rsc-ssr-false')
    await page.waitForURL('/rsc-ssr-false')
    await waitForHydration(page)

    // Clear canvas to reset state
    await page.getByTestId('clear-canvas-btn').click()

    await expect(page.getByTestId('save-controls')).toBeVisible()

    await page.getByTestId('drawing-name-input').fill('Saved Drawing')
    await page.getByTestId('save-drawing-btn').click()

    // Also select a color (which saves to localStorage)
    await page.getByTestId('color-purple').click()

    // Verify purple color button is selected (has thicker border)
    const purpleBtn = page.getByTestId('color-purple')
    await expect(purpleBtn).toHaveCSS('border-width', '3px')

    // Navigate away
    await page.goto('/')
    await page.waitForURL('/')
    await waitForHydration(page)

    // Navigate back
    await page.goto('/rsc-ssr-false')
    await page.waitForURL('/rsc-ssr-false')
    await waitForHydration(page)

    // Verify saved name is restored
    await expect(page.getByTestId('rsc-saved-name')).toBeVisible()
    await expect(page.getByTestId('rsc-saved-name')).toContainText(
      'Saved Drawing',
    )

    // Verify last color is restored (shown in RSC)
    await expect(page.getByTestId('rsc-last-color')).toBeVisible()
    await expect(page.getByTestId('rsc-last-color')).toContainText('#9333ea')

    // Verify purple color is pre-selected in the client canvas component
    const purpleBtnAfterReload = page.getByTestId('color-purple')
    await expect(purpleBtnAfterReload).toHaveCSS('border-width', '3px')
  })

  test('Full page reload works correctly', async ({ page }) => {
    await page.goto('/rsc-ssr-false')
    await page.waitForURL('/rsc-ssr-false')
    await waitForHydration(page)

    // Verify initial load
    await expect(page.getByTestId('rsc-ssr-false-content')).toBeVisible()

    // Clear any previous drawing first
    await page.getByTestId('clear-canvas-btn').click()

    // Draw something
    await drawStroke(page, { x: 50, y: 50 }, { x: 150, y: 100 })

    // Verify stroke was counted
    await expect(page.getByTestId('canvas-container')).toContainText(
      'Strokes: 1',
    )

    // Reload page
    await page.reload()
    await page.waitForURL('/rsc-ssr-false')
    await waitForHydration(page)

    // Verify content reloads and drawing was restored from localStorage
    await expect(page.getByTestId('rsc-ssr-false-content')).toBeVisible()
    await expect(page.getByTestId('canvas-container')).toBeVisible()
    await expect(page.getByTestId('restored-indicator')).toBeVisible()
    await expect(page.getByTestId('restored-indicator')).toContainText(
      'Restored from localStorage',
    )

    // Verify stroke count was also restored
    await expect(page.getByTestId('canvas-container')).toContainText(
      'Strokes: 1',
    )
  })
})
