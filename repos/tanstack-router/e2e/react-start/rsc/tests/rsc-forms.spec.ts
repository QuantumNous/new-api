import { expect, type Page } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

async function getTodoCount(page: Page) {
  const countText = await page.getByTestId('rsc-todo-count').textContent()
  const match = countText?.match(/\d+\/(\d+) completed/)

  if (!match) {
    throw new Error(`Unexpected todo count text: ${countText}`)
  }

  return Number(match[1])
}

test.describe('RSC Forms Tests - Todo list with mutations', () => {
  test('Page loads with todo list visible', async ({ page }) => {
    await page.goto('/rsc-forms')
    await page.waitForURL('/rsc-forms')

    // Verify page title
    await expect(page.getByTestId('rsc-forms-title')).toHaveText(
      'Todo List - RSC with Forms',
    )

    // Verify form is visible
    await expect(page.getByTestId('todo-form')).toBeVisible()
    await expect(page.getByTestId('todo-input')).toBeVisible()
    await expect(page.getByTestId('add-todo-btn')).toBeVisible()
  })

  test('Add todo button is disabled when input is empty', async ({ page }) => {
    await page.goto('/rsc-forms')
    await page.waitForURL('/rsc-forms')
    await waitForHydration(page)

    // Verify button is disabled with empty input
    await expect(page.getByTestId('add-todo-btn')).toBeDisabled()

    // Type something
    await page.getByTestId('todo-input').fill('Test todo')

    // Now button should be enabled
    await expect(page.getByTestId('add-todo-btn')).toBeEnabled()

    // Clear input
    await page.getByTestId('todo-input').fill('')

    // Button should be disabled again
    await expect(page.getByTestId('add-todo-btn')).toBeDisabled()
  })

  test('Adding a todo refreshes the RSC', async ({ page }) => {
    await page.goto('/rsc-forms')
    await page.waitForURL('/rsc-forms')
    await waitForHydration(page)

    const initialCount = await getTodoCount(page)

    // Add a new todo
    const todoText = `Test Todo ${Date.now()}`
    await page.getByTestId('todo-input').fill(todoText)
    await page.getByTestId('add-todo-btn').click()

    // Wait for the mutation and route invalidation to settle.
    await expect(page.getByTestId('todo-input')).toHaveValue('')
    await expect(page.getByTestId('rsc-todo-list')).toContainText(todoText)
    await expect(page.getByTestId('rsc-todo-count')).toContainText(
      `/${initialCount + 1} completed`,
    )

    // Verify input is cleared after submission
    await expect(page.getByTestId('todo-input')).toHaveValue('')
  })

  test('Todo input clears after successful submission', async ({ page }) => {
    await page.goto('/rsc-forms')
    await page.waitForURL('/rsc-forms')
    await waitForHydration(page)

    // Type and submit
    await page.getByTestId('todo-input').fill('Clear test todo')
    await expect(page.getByTestId('todo-input')).toHaveValue('Clear test todo')

    await page.getByTestId('add-todo-btn').click()

    // Input should be cleared
    await expect(page.getByTestId('todo-input')).toHaveValue('')
  })

  test('Form submission works via Enter key', async ({ page }) => {
    await page.goto('/rsc-forms')
    await page.waitForURL('/rsc-forms')
    await waitForHydration(page)

    const initialCount = await getTodoCount(page)

    // Type and press Enter
    const todoText = `Enter key todo ${Date.now()}`
    await page.getByTestId('todo-input').fill(todoText)
    await page.getByTestId('todo-input').press('Enter')

    await expect(page.getByTestId('todo-input')).toHaveValue('')
    await expect(page.getByTestId('rsc-todo-list')).toContainText(todoText)
    await expect(page.getByTestId('rsc-todo-count')).toContainText(
      `/${initialCount + 1} completed`,
    )

    // Input should be cleared
    await expect(page.getByTestId('todo-input')).toHaveValue('')
  })

  test('Multiple todos can be added in sequence', async ({ page }) => {
    await page.goto('/rsc-forms')
    await page.waitForURL('/rsc-forms')
    await waitForHydration(page)

    let expectedCount = await getTodoCount(page)

    // Add first todo
    const firstTodo = `First todo ${Date.now()}`
    await page.getByTestId('todo-input').fill(firstTodo)
    await page.getByTestId('add-todo-btn').click()
    await expect(page.getByTestId('todo-input')).toHaveValue('')
    expectedCount += 1
    await expect(page.getByTestId('rsc-todo-list')).toContainText(firstTodo)
    await expect(page.getByTestId('rsc-todo-count')).toContainText(
      `/${expectedCount} completed`,
    )

    // Add second todo
    const secondTodo = `Second todo ${Date.now()}`
    await page.getByTestId('todo-input').fill(secondTodo)
    await page.getByTestId('add-todo-btn').click()
    await expect(page.getByTestId('todo-input')).toHaveValue('')
    expectedCount += 1
    await expect(page.getByTestId('rsc-todo-list')).toContainText(secondTodo)
    await expect(page.getByTestId('rsc-todo-count')).toContainText(
      `/${expectedCount} completed`,
    )

    // Add third todo
    const thirdTodo = `Third todo ${Date.now()}`
    await page.getByTestId('todo-input').fill(thirdTodo)
    await page.getByTestId('add-todo-btn').click()
    await expect(page.getByTestId('todo-input')).toHaveValue('')
    expectedCount += 1
    await expect(page.getByTestId('rsc-todo-list')).toContainText(thirdTodo)
    await expect(page.getByTestId('rsc-todo-count')).toContainText(
      `/${expectedCount} completed`,
    )
  })

  test('Whitespace-only input does not submit', async ({ page }) => {
    await page.goto('/rsc-forms')
    await page.waitForURL('/rsc-forms')
    await waitForHydration(page)

    // Type whitespace only
    await page.getByTestId('todo-input').fill('   ')

    // Button should still be disabled (or at least not submit)
    // Note: The implementation trims, so this might not add anything
    const initialTimestamp = await page
      .getByTestId('loader-timestamp')
      .textContent()

    // Try to submit
    await page.getByTestId('add-todo-btn').click({ force: true })

    // Timestamp should not change for whitespace-only input
    // (depends on implementation - if trim() is used, it won't submit)
    await expect(page.getByTestId('todo-input')).toHaveValue('   ')
    const newTimestamp = await page
      .getByTestId('loader-timestamp')
      .textContent()
    expect(newTimestamp).toBe(initialTimestamp)
  })
})
