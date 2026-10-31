import { expect } from '@playwright/test'
import { test } from '@tanstack/router-e2e-utils'
import { waitForHydration } from './hydration'

test.describe('RSC Tree Restructuring - Moving RSC without reload', () => {
  test('Changing parent element type does not reload RSC', async ({ page }) => {
    await page.goto('/rsc-tree')
    await page.waitForURL('/rsc-tree')
    await waitForHydration(page)

    // Get initial RSC timestamp and instance ID
    const initialRscTimestamp = await page
      .getByTestId('rsc-tree-timestamp')
      .textContent()
    const initialInstanceId = await page
      .getByTestId('rsc-tree-instance-id')
      .textContent()

    // Verify initial parent type
    await expect(page.getByTestId('current-parent-type')).toContainText('div')

    // Change to section
    await page.getByTestId('change-parent-section').click()
    await expect(page.getByTestId('current-parent-type')).toContainText(
      'section',
    )

    // Verify RSC timestamp and instance ID are unchanged
    let newRscTimestamp = await page
      .getByTestId('rsc-tree-timestamp')
      .textContent()
    let newInstanceId = await page
      .getByTestId('rsc-tree-instance-id')
      .textContent()
    expect(newRscTimestamp).toBe(initialRscTimestamp)
    expect(newInstanceId).toBe(initialInstanceId)

    // Change to article
    await page.getByTestId('change-parent-article').click()
    await expect(page.getByTestId('current-parent-type')).toContainText(
      'article',
    )

    // Verify RSC is still unchanged
    newRscTimestamp = await page.getByTestId('rsc-tree-timestamp').textContent()
    newInstanceId = await page.getByTestId('rsc-tree-instance-id').textContent()
    expect(newRscTimestamp).toBe(initialRscTimestamp)
    expect(newInstanceId).toBe(initialInstanceId)

    // Change back to div
    await page.getByTestId('change-parent-div').click()
    await expect(page.getByTestId('current-parent-type')).toContainText('div')

    // Verify RSC is still unchanged
    newRscTimestamp = await page.getByTestId('rsc-tree-timestamp').textContent()
    newInstanceId = await page.getByTestId('rsc-tree-instance-id').textContent()
    expect(newRscTimestamp).toBe(initialRscTimestamp)
    expect(newInstanceId).toBe(initialInstanceId)
  })

  test('Adding wrapper elements does not reload RSC', async ({ page }) => {
    await page.goto('/rsc-tree')
    await page.waitForURL('/rsc-tree')
    await waitForHydration(page)

    // Get initial RSC timestamp
    const initialRscTimestamp = await page
      .getByTestId('rsc-tree-timestamp')
      .textContent()

    // Verify initial wrapper count
    await expect(page.getByTestId('current-wrapper-count')).toContainText('0')

    // Add wrapper
    await page.getByTestId('add-wrapper').click()
    await expect(page.getByTestId('current-wrapper-count')).toContainText('1')
    await expect(page.getByTestId('wrapper-1')).toBeVisible()

    // Verify RSC timestamp is unchanged
    let newRscTimestamp = await page
      .getByTestId('rsc-tree-timestamp')
      .textContent()
    expect(newRscTimestamp).toBe(initialRscTimestamp)

    // Add more wrappers
    await page.getByTestId('add-wrapper').click()
    await page.getByTestId('add-wrapper').click()
    await expect(page.getByTestId('current-wrapper-count')).toContainText('3')
    await expect(page.getByTestId('wrapper-3')).toBeVisible()

    // Verify RSC timestamp is still unchanged
    newRscTimestamp = await page.getByTestId('rsc-tree-timestamp').textContent()
    expect(newRscTimestamp).toBe(initialRscTimestamp)
  })

  test('Removing wrapper elements does not reload RSC', async ({ page }) => {
    await page.goto('/rsc-tree')
    await page.waitForURL('/rsc-tree')
    await waitForHydration(page)

    // Add some wrappers first
    await page.getByTestId('add-wrapper').click()
    await page.getByTestId('add-wrapper').click()
    await expect(page.getByTestId('current-wrapper-count')).toContainText('2')

    // Get RSC timestamp after adding wrappers
    const rscTimestampAfterAdd = await page
      .getByTestId('rsc-tree-timestamp')
      .textContent()

    // Remove wrapper
    await page.getByTestId('remove-wrapper').click()
    await expect(page.getByTestId('current-wrapper-count')).toContainText('1')

    // Verify RSC timestamp is unchanged
    let newRscTimestamp = await page
      .getByTestId('rsc-tree-timestamp')
      .textContent()
    expect(newRscTimestamp).toBe(rscTimestampAfterAdd)

    // Remove all wrappers
    await page.getByTestId('remove-wrapper').click()
    await expect(page.getByTestId('current-wrapper-count')).toContainText('0')

    // Verify RSC timestamp is still unchanged
    newRscTimestamp = await page.getByTestId('rsc-tree-timestamp').textContent()
    expect(newRscTimestamp).toBe(rscTimestampAfterAdd)
  })

  test('Combined parent and wrapper changes do not reload RSC', async ({
    page,
  }) => {
    await page.goto('/rsc-tree')
    await page.waitForURL('/rsc-tree')
    await waitForHydration(page)

    // Get initial RSC timestamp
    const initialRscTimestamp = await page
      .getByTestId('rsc-tree-timestamp')
      .textContent()

    // Make multiple changes
    await page.getByTestId('change-parent-section').click()
    await page.getByTestId('add-wrapper').click()
    await page.getByTestId('add-wrapper').click()
    await page.getByTestId('change-parent-article').click()
    await page.getByTestId('remove-wrapper').click()
    await page.getByTestId('change-parent-div').click()

    // Verify final state
    await expect(page.getByTestId('current-parent-type')).toContainText('div')
    await expect(page.getByTestId('current-wrapper-count')).toContainText('1')

    // Verify RSC timestamp is unchanged through all changes
    const newRscTimestamp = await page
      .getByTestId('rsc-tree-timestamp')
      .textContent()
    expect(newRscTimestamp).toBe(initialRscTimestamp)
  })

  test('RSC position prop updates without reload', async ({ page }) => {
    await page.goto('/rsc-tree')
    await page.waitForURL('/rsc-tree')
    await waitForHydration(page)

    // Get initial RSC timestamp
    const initialRscTimestamp = await page
      .getByTestId('rsc-tree-timestamp')
      .textContent()

    // Verify initial position
    await expect(page.getByTestId('rsc-tree-position')).toContainText(
      '<div> with 0 wrapper(s) at top',
    )

    // Change parent and wrapper
    await page.getByTestId('change-parent-section').click()
    await page.getByTestId('add-wrapper').click()

    // Verify position updated
    await expect(page.getByTestId('rsc-tree-position')).toContainText(
      '<section> with 1 wrapper(s) at top',
    )

    // RSC timestamp should be unchanged (position is a slot prop, not server data)
    const newRscTimestamp = await page
      .getByTestId('rsc-tree-timestamp')
      .textContent()
    expect(newRscTimestamp).toBe(initialRscTimestamp)
  })
})
