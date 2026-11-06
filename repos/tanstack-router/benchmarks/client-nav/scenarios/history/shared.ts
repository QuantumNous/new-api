/**
 * Shared definition of the `history` scenario: push/replace/back/forward
 * traversal, location masking, blocker registration overhead (the blocker
 * never blocks), and useLocation/useCanGoBack subscriptions.
 *
 * The step lap is designed to keep the history depth stationary: it ends back
 * on the initial entry, so the first push of the next lap truncates the stale
 * forward tail and the session history never grows past 4 entries.
 */
import type { ScenarioStep } from '../harness'

export const pageIds = ['1', '2', '3'] as const
export const maskedPhotoId = '42'

export function pageLabel(n: string) {
  return `Page ${n}`
}

export function photoLabel(id: string) {
  return `Photo ${id}`
}

/** Registered on every navigation, never blocks. */
export const shouldBlockFn = () => false

interface HistoryStepExpectation {
  step: ScenarioStep
  /** Expected router location pathname (the REAL location, even when masked). */
  pathname: string
  /** Expected window.location pathname when it differs (location masking). */
  windowPathname?: string
  /** Marker test id that must be present in the container after the step. */
  marker?: string
}

export const stepExpectations: ReadonlyArray<HistoryStepExpectation> = [
  { step: 'p-1', pathname: '/pages/1', marker: 'page-state' },
  { step: 'p-2', pathname: '/pages/2', marker: 'page-state' },
  {
    step: 'photo-masked',
    pathname: `/photos/${maskedPhotoId}`,
    windowPathname: '/gallery',
    marker: 'photo-state',
  },
  { step: { type: 'back' }, pathname: '/pages/2', marker: 'page-state' },
  { step: { type: 'back' }, pathname: '/pages/1', marker: 'page-state' },
  { step: { type: 'forward' }, pathname: '/pages/2', marker: 'page-state' },
  { step: 'p-3-replace', pathname: '/pages/3', marker: 'page-state' },
  { step: { type: 'back' }, pathname: '/pages/1', marker: 'page-state' },
  { step: { type: 'back' }, pathname: '/', marker: 'home-state' },
]

export const steps = stepExpectations.map((expectation) => expectation.step)

export function assertStepResult(stepIndex: number, container: HTMLElement) {
  const expected = stepExpectations[stepIndex]!

  const loc = container.querySelector('[data-testid="loc"]')?.textContent
  if (loc !== expected.pathname) {
    throw new Error(
      `Expected location marker to be "${expected.pathname}" after step ${stepIndex}, received "${loc}"`,
    )
  }

  const windowPathname = expected.windowPathname ?? expected.pathname
  if (window.location.pathname !== windowPathname) {
    throw new Error(
      `Expected window.location.pathname to be "${windowPathname}" after step ${stepIndex}, received "${window.location.pathname}"`,
    )
  }

  if (
    expected.marker &&
    !container.querySelector(`[data-testid="${expected.marker}"]`)
  ) {
    throw new Error(
      `Expected marker "${expected.marker}" to be rendered after step ${stepIndex}`,
    )
  }
}

// Two laps through the 9-step sequence per benchmark iteration.
export const ticksPerIteration = 18

export const benchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}
