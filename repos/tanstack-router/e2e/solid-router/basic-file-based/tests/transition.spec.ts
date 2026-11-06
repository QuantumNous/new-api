import { expect, test } from '@playwright/test'

test('transitions/count/create-resource should keep old values visible during navigation', async ({
  page,
}) => {
  await page.goto('/transition/count/create-resource')

  await expect(page.getByTestId('n-value')).toContainText('n: 1')
  await expect(page.getByTestId('double-value')).toContainText('double: 2')

  const bodyTexts: Array<string> = []

  const pollInterval = setInterval(async () => {
    const text = await page
      .locator('body')
      .textContent()
      .catch(() => '')
    if (text) bodyTexts.push(text)
  }, 50)

  // 1 click

  page.getByTestId('increase-button').click()

  await expect(page.getByTestId('n-value')).toContainText('n: 1', {
    timeout: 2_000,
  })
  await expect(page.getByTestId('double-value')).toContainText('double: 2', {
    timeout: 2_000,
  })

  await page.waitForTimeout(200)

  await expect(page.getByTestId('n-value')).toContainText('n: 2', {
    timeout: 2000,
  })
  await expect(page.getByTestId('double-value')).toContainText('double: 4', {
    timeout: 2000,
  })

  // 2 clicks

  page.getByTestId('increase-button').click()
  page.getByTestId('increase-button').click()

  await expect(page.getByTestId('n-value')).toContainText('n: 2', {
    timeout: 2000,
  })
  await expect(page.getByTestId('double-value')).toContainText('double: 4', {
    timeout: 2000,
  })

  await page.waitForTimeout(200)

  await expect(page.getByTestId('n-value')).toContainText('n: 4', {
    timeout: 2000,
  })
  await expect(page.getByTestId('double-value')).toContainText('double: 8', {
    timeout: 2000,
  })

  // 3 clicks

  page.getByTestId('increase-button').click()
  page.getByTestId('increase-button').click()
  page.getByTestId('increase-button').click()

  await expect(page.getByTestId('n-value')).toContainText('n: 4', {
    timeout: 2000,
  })
  await expect(page.getByTestId('double-value')).toContainText('double: 8', {
    timeout: 2000,
  })

  await page.waitForTimeout(200)

  await expect(page.getByTestId('n-value')).toContainText('n: 7', {
    timeout: 2000,
  })
  await expect(page.getByTestId('double-value')).toContainText('double: 14', {
    timeout: 2000,
  })

  clearInterval(pollInterval)

  // With proper transitions, old values should remain visible until new ones arrive
  const hasLoadingText = bodyTexts.some((text) => text.includes('Loading...'))

  if (hasLoadingText) {
    throw new Error(
      'FAILED: "Loading..." appeared during navigation. ' +
        'Solid Router should use transitions to keep old values visible.',
    )
  }
})
