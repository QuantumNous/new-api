import { expect, test } from '@playwright/test'

const storageKey = 'tsr-scroll-restoration-v1_3'

test('carries existing nested scroll entries to the next key', async ({
  page,
}) => {
  await page.goto('/nested-scroll-carry-over-a')
  await page.waitForLoadState('networkidle')
  await expect(
    page.getByRole('heading', { name: 'nested-scroll-carry-over-a' }),
  ).toBeVisible()

  const positions = await page.evaluate(() => {
    const getScroller = (testId: string) => {
      const element = document.querySelector(`[data-testid="${testId}"]`)
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing ${testId}`)
      }
      return element
    }

    const preserved = getScroller('carry-over-preserved')
    const reset = getScroller('carry-over-reset')
    const sourceOnly = getScroller('carry-over-source-only')

    preserved.scrollTop = 80
    reset.scrollTop = 80
    sourceOnly.scrollTop = 80

    preserved.dispatchEvent(new Event('scroll', { bubbles: true }))
    reset.dispatchEvent(new Event('scroll', { bubbles: true }))
    sourceOnly.dispatchEvent(new Event('scroll', { bubbles: true }))

    return {
      preserved: preserved.scrollTop,
      reset: reset.scrollTop,
      sourceOnly: sourceOnly.scrollTop,
    }
  })

  expect(positions.preserved).toBeGreaterThan(0)
  expect(positions.reset).toBeGreaterThan(0)
  expect(positions.sourceOnly).toBeGreaterThan(0)

  await page.getByTestId('nested-scroll-carry-over-link').click()
  await expect(
    page.getByRole('heading', { name: 'nested-scroll-carry-over-b' }),
  ).toBeVisible()

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const element = document.querySelector(
          '[data-testid="carry-over-preserved"]',
        )
        return element instanceof HTMLElement ? element.scrollTop : 0
      })
    })
    .toBe(positions.preserved)

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const element = document.querySelector(
          '[data-testid="carry-over-reset"]',
        )
        return element instanceof HTMLElement ? element.scrollTop : -1
      })
    })
    .toBe(0)

  await page.reload()
  await page.waitForLoadState('networkidle')
  await expect(
    page.getByRole('heading', { name: 'nested-scroll-carry-over-b' }),
  ).toBeVisible()

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const element = document.querySelector(
          '[data-testid="carry-over-preserved"]',
        )
        return element instanceof HTMLElement ? element.scrollTop : 0
      })
    })
    .toBe(positions.preserved)

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const element = document.querySelector(
          '[data-testid="carry-over-reset"]',
        )
        return element instanceof HTMLElement ? element.scrollTop : -1
      })
    })
    .toBe(0)

  const targetKeyEntries = await page.evaluate((scrollStorageKey) => {
    const targetKey = window.history.state.__TSR_key
    const raw = window.sessionStorage.getItem(scrollStorageKey)
    const state = raw ? JSON.parse(raw) : {}
    const entries = state[targetKey] ?? {}

    return {
      hasPreserved: Object.hasOwn(
        entries,
        '[data-scroll-restoration-id="carry-over-preserved"]',
      ),
      hasReset: Object.hasOwn(
        entries,
        '[data-scroll-restoration-id="carry-over-reset"]',
      ),
      hasSourceOnly: Object.hasOwn(
        entries,
        '[data-scroll-restoration-id="carry-over-source-only"]',
      ),
    }
  }, storageKey)

  expect(targetKeyEntries).toEqual({
    hasPreserved: true,
    hasReset: false,
    hasSourceOnly: false,
  })
})

test('restores carried nested scroll after search navigation and browser back', async ({
  page,
}) => {
  await page.goto('/nested-scroll-search')
  await page.waitForLoadState('networkidle')
  await expect(
    page.getByRole('heading', { name: 'nested-scroll-search' }),
  ).toBeVisible()

  const scrollTop = await page.evaluate(() => {
    const element = document.querySelector(
      '[data-testid="nested-scroll-search-container"]',
    )
    if (!(element instanceof HTMLElement)) {
      throw new Error('Missing nested scroll container')
    }

    element.scrollTop = 80
    element.dispatchEvent(new Event('scroll', { bubbles: true }))
    return element.scrollTop
  })

  expect(scrollTop).toBeGreaterThan(0)

  await page.getByTestId('nested-scroll-search-link').click()
  await expect(page.getByTestId('nested-scroll-search-query')).toHaveText(
    'query: xyz',
  )

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const element = document.querySelector(
          '[data-testid="nested-scroll-search-container"]',
        )
        return element instanceof HTMLElement ? element.scrollTop : 0
      })
    })
    .toBe(scrollTop)

  await page.getByTestId('nested-scroll-away-link').click()
  await expect(
    page.getByRole('heading', { name: 'nested-scroll-away' }),
  ).toBeVisible()
  await expect(page.getByTestId('nested-scroll-search-container')).toHaveCount(
    0,
  )

  await page.goBack()
  await expect(
    page.getByRole('heading', { name: 'nested-scroll-search' }),
  ).toBeVisible()
  await expect(page.getByTestId('nested-scroll-search-query')).toHaveText(
    'query: xyz',
  )

  await expect
    .poll(async () => {
      return page.evaluate(() => {
        const element = document.querySelector(
          '[data-testid="nested-scroll-search-container"]',
        )
        return element instanceof HTMLElement ? element.scrollTop : 0
      })
    })
    .toBe(scrollTop)
})
