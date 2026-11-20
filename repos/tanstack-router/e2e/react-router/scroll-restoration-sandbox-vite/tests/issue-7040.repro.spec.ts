import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { toRuntimePath } from '@tanstack/router-e2e-utils'

const attemptCount = 3
const sourceScrollTargetY = 6000
const fastScrollStepPx = 220
const fastScrollDelayMs = 3
const maxFastScrollSteps = 80
const preClickReverseScrollPx = 60

type ReproAttempt = {
  attempt: number
  before: {
    sourceKey: string
    sourceScrollY: number
    sourceHeight: number
  }
  after: {
    destinationKey: string
    destinationScrollY: number
    destinationHeight: number
    destinationMaxScrollY: number
  }
}

async function openFreshSourcePage(page: Page) {
  await page.goto(toRuntimePath('/issue-7040-source'))
  await page.waitForLoadState('networkidle')

  await page.evaluate(() => {
    sessionStorage.clear()
    window.scrollTo(0, 0)
  })

  await page.reload()
  await page.waitForLoadState('networkidle')
}

async function fastScrollSourcePage(page: Page) {
  await page.evaluate(
    async ({ targetScrollY, stepPx, stepDelayMs, maxSteps }) => {
      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms))

      window.scrollTo(0, 0)

      let steps = 0

      while (window.scrollY < targetScrollY && steps < maxSteps) {
        window.scrollBy(0, stepPx)
        steps += 1
        await sleep(stepDelayMs)
      }

      if (window.scrollY < targetScrollY) {
        throw new Error(
          `Could not reach source scroll target ${targetScrollY}; got ${window.scrollY}`,
        )
      }
    },
    {
      targetScrollY: sourceScrollTargetY,
      stepPx: fastScrollStepPx,
      stepDelayMs: fastScrollDelayMs,
      maxSteps: maxFastScrollSteps,
    },
  )
}

async function clickTargetLinkImmediatelyAfterScroll(page: Page) {
  await page.evaluate(
    ({ reverseScrollPx }) => {
      const link = document.querySelector(
        '[data-testid="issue-7040-target-link"]',
      )

      if (!(link instanceof HTMLAnchorElement)) {
        throw new Error('issue-7040 target link not found')
      }

      // Trigger one more browser scroll update immediately before navigation
      // so the test stays focused on the stale-scroll race.
      window.scrollBy(0, -reverseScrollPx)
      link.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        }),
      )
    },
    { reverseScrollPx: preClickReverseScrollPx },
  )
}

async function waitForTargetPageToSettle(page: Page) {
  await page.waitForURL('**/issue-7040-target')
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(() => window.scrollY === 0)
}

test('Issue #7040 repro: fast scroll then click can restore target below top', async ({
  page,
}) => {
  const attempts: Array<ReproAttempt> = []

  for (let attempt = 0; attempt < attemptCount; attempt++) {
    await openFreshSourcePage(page)
    await fastScrollSourcePage(page)

    const before = await page.evaluate(() => {
      return {
        sourceKey: window.history.state.__TSR_key,
        sourceScrollY: window.scrollY,
        sourceHeight: document.documentElement.scrollHeight,
      }
    })

    await clickTargetLinkImmediatelyAfterScroll(page)
    await waitForTargetPageToSettle(page)

    const after = await page.evaluate(() => {
      return {
        destinationKey: window.history.state.__TSR_key,
        destinationScrollY: window.scrollY,
        destinationHeight: document.documentElement.scrollHeight,
        destinationMaxScrollY:
          document.documentElement.scrollHeight - window.innerHeight,
      }
    })

    attempts.push({ attempt, before, after })
  }

  for (const attempt of attempts) {
    expect(attempt.before.sourceHeight).toBeGreaterThan(15000)
    expect(attempt.before.sourceScrollY).toBeGreaterThan(sourceScrollTargetY)
    expect(attempt.before.sourceKey).not.toBe(attempt.after.destinationKey)
    expect(attempt.before.sourceScrollY).toBeGreaterThan(
      attempt.after.destinationMaxScrollY,
    )
    expect(attempt.after.destinationHeight).toBeLessThan(
      attempt.before.sourceHeight,
    )
    expect(attempt.after.destinationScrollY).toBe(0)
    expect(attempt.after.destinationScrollY).toBeLessThanOrEqual(
      attempt.after.destinationMaxScrollY,
    )
  }
})
