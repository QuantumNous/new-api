import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'

test('merge-middleware-context', async ({ page }) => {
  await page.goto('/merge-middleware-context')

  await page.waitForLoadState('networkidle')

  await page.getByTestId('test-middleware-context-btn').click()
  await page.waitForLoadState('networkidle')

  await expect(page.getByTestId('has-test-parent')).toContainText('true')
  await expect(page.getByTestId('has-test')).toContainText('true')

  const contextResult = await page.getByTestId('context-result').textContent()
  expect(contextResult).toContain('testParent')
  expect(contextResult).toContain('test')
})

test.describe('methods', () => {
  test('only ANY', async ({ page }) => {
    await page.goto('/methods/only-any')

    // wait for page to be loaded by waiting for the route component to be rendered
    await expect(page.getByTestId('route-component')).toBeInViewport()

    const testCases = await page
      .locator('[data-testid^="expected-"]')
      .elementHandles()
    expect(testCases.length).not.toBe(0)
    for (const testCase of testCases) {
      const testId = await testCase.getAttribute('data-testid')

      if (!testId) {
        throw new Error('testcase is missing data-testid')
      }

      const suffix = testId.replace('expected-', '')

      const expected =
        (await page.getByTestId(`expected-${suffix}`).textContent()) || ''
      expect(expected).not.toBe('')

      await expect(page.getByTestId(`result-${suffix}`)).toContainText(expected)
    }
  })
})
