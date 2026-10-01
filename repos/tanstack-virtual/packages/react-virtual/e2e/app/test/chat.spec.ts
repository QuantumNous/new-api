import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function waitForEnd(page: Page) {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const container = document.querySelector('#scroll-container')
        if (!container) throw new Error('Container not found')
        return Math.abs(
          container.scrollHeight - container.scrollTop - container.clientHeight,
        )
      }),
    )
    .toBeLessThan(1.01)
}

async function maybeFirstVisibleMessage(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')

    const containerRect = container.getBoundingClientRect()
    const items = Array.from(
      container.querySelectorAll<HTMLElement>('[data-message-id]'),
    )

    const item = items.find((node) => {
      const rect = node.getBoundingClientRect()
      return (
        rect.bottom > containerRect.top + 1 &&
        rect.top < containerRect.bottom - 1
      )
    })

    if (!item) return null

    return {
      id: item.dataset.messageId,
      top: item.getBoundingClientRect().top - containerRect.top,
      scrollTop: container.scrollTop,
    }
  })
}

async function firstVisibleMessage(page: Page) {
  const item = await maybeFirstVisibleMessage(page)
  if (!item) throw new Error('No visible message found')
  return item
}

async function getScrollState(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')

    return {
      scrollTop: container.scrollTop,
      scrollHeight: container.scrollHeight,
    }
  })
}

async function waitForFirstVisibleAtOffset(page: Page, scrollTop: number) {
  await expect
    .poll(async () => {
      const item = await maybeFirstVisibleMessage(page)
      return item?.scrollTop
    })
    .toBe(scrollTop)
}

test('chat mode keeps visible messages stable when history is prepended', async ({
  page,
}) => {
  await page.goto('/chat/')
  await waitForEnd(page)

  await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    container.scrollTop = 350
  })
  await waitForFirstVisibleAtOffset(page, 350)

  const before = await firstVisibleMessage(page)

  await page.click('#prepend')
  await expect
    .poll(async () => {
      const after = await maybeFirstVisibleMessage(page)
      return (
        after !== null &&
        after.id === before.id &&
        Math.abs(after.top - before.top) < 1.01 &&
        after.scrollTop - before.scrollTop > 249
      )
    })
    .toBe(true)

  const after = await firstVisibleMessage(page)

  expect(after.id).toBe(before.id)
  expect(Math.abs(after.top - before.top)).toBeLessThan(1.01)
  expect(after.scrollTop - before.scrollTop).toBeGreaterThan(249)
})

test('chat mode does not follow appended messages while reading history', async ({
  page,
}) => {
  await page.goto('/chat/')
  await waitForEnd(page)

  await page.evaluate(() => {
    const container = document.querySelector('#scroll-container')
    if (!container) throw new Error('Container not found')
    container.scrollTop = 350
  })
  await waitForFirstVisibleAtOffset(page, 350)

  const before = await getScrollState(page)

  await page.click('#append')
  await expect
    .poll(async () => {
      const after = await getScrollState(page)
      return (
        after.scrollHeight > before.scrollHeight &&
        Math.abs(after.scrollTop - before.scrollTop) < 1.01
      )
    })
    .toBe(true)

  const after = await getScrollState(page)

  expect(Math.abs(after.scrollTop - before.scrollTop)).toBeLessThan(1.01)
  await expect(page.locator('[data-testid="message-m-30"]')).not.toBeVisible()
})

test('chat mode follows appended messages from the end', async ({ page }) => {
  await page.goto('/chat/')
  await waitForEnd(page)

  await page.click('#append')
  await waitForEnd(page)

  await expect(page.locator('[data-testid="message-m-30"]')).toBeVisible()
})

test('chat mode keeps streaming bottom message pinned as it grows', async ({
  page,
}) => {
  await page.goto('/chat/')
  await waitForEnd(page)

  await page.click('#grow-last')
  await waitForEnd(page)

  await expect(page.locator('[data-testid="message-m-29"]')).toBeVisible()
})
