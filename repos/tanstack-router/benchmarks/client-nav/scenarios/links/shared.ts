/**
 * Shared definition of the `links` scenario: a large persistent grid of
 * `<Link>`s in the root layout so every navigation recomputes link props and
 * active state across many activeOptions variants, plus `useMatchRoute` /
 * `MatchRoute` consumers. The three framework apps consume these constants so
 * the workload is identical modulo the rendering layer.
 */
import type { ScenarioStep } from '../harness'

// 40 item ids x 5 link variants = 200 links mounted in the root layout.
export const LINK_ITEM_COUNT = 40
export const LINK_VARIANT_COUNT = 5

export const itemIds = Array.from({ length: LINK_ITEM_COUNT }, (_, index) =>
  String(index + 1),
)

// Static search object attached to the includeSearch:false variant.
export const variantSearch = { tab: 'specs', page: 2 }

// Item ids that get a `go-item-<id>` test id on their plain variant link.
export const stepItemIds = ['1', '7', '13', '25', '40']

// Ids probed by the useMatchRoute checks in the root StatusPanel.
export const matchProbeIds = [
  '1',
  '5',
  '7',
  '13',
  '20',
  '25',
  '30',
  '35',
  '40',
  '2',
]

export function itemMarker(id: string) {
  return `item-${id}`
}

export const homeMarker = 'home'
export const aboutMarker = 'about'

interface StepDef {
  testId: string
  marker: string
  /** Expected number of `.active-link` elements after the step. */
  activeCount: number
  /** When one link is active, its href must include this substring. */
  activeHrefPart?: string
}

export const stepDefs: ReadonlyArray<StepDef> = [
  {
    testId: 'go-item-1',
    marker: itemMarker('1'),
    activeCount: 1,
    activeHrefPart: '/items/1',
  },
  {
    testId: 'go-item-7',
    marker: itemMarker('7'),
    activeCount: 1,
    activeHrefPart: '/items/7',
  },
  { testId: 'go-about', marker: aboutMarker, activeCount: 0 },
  {
    testId: 'go-item-13',
    marker: itemMarker('13'),
    activeCount: 1,
    activeHrefPart: '/items/13',
  },
  {
    testId: 'go-item-25',
    marker: itemMarker('25'),
    activeCount: 1,
    activeHrefPart: '/items/25',
  },
  {
    testId: 'go-item-40',
    marker: itemMarker('40'),
    activeCount: 1,
    activeHrefPart: '/items/40',
  },
  {
    testId: 'go-item-7',
    marker: itemMarker('7'),
    activeCount: 1,
    activeHrefPart: '/items/7',
  },
  { testId: 'go-home', marker: homeMarker, activeCount: 0 },
]

export const scenarioSteps: ReadonlyArray<ScenarioStep> = stepDefs.map(
  (step) => step.testId,
)

export function assertStepResult(stepIndex: number, container: HTMLElement) {
  const step = stepDefs[stepIndex]!

  const marker = container.querySelector('[data-testid="page-state"]')
  if (marker?.textContent !== step.marker) {
    throw new Error(
      `Expected page marker "${step.marker}" after step ${stepIndex}, received "${marker?.textContent}"`,
    )
  }

  const activeLinks = container.querySelectorAll('a.active-link')
  if (activeLinks.length !== step.activeCount) {
    throw new Error(
      `Expected ${step.activeCount} active link(s) after step ${stepIndex}, received ${activeLinks.length}`,
    )
  }
  if (step.activeHrefPart) {
    const href = activeLinks[0]!.getAttribute('href') ?? ''
    if (!href.includes(step.activeHrefPart)) {
      throw new Error(
        `Expected the active link href to include "${step.activeHrefPart}" after step ${stepIndex}, received "${href}"`,
      )
    }
  }
}

// One lap through the 8-step sequence per benchmark iteration; each step
// recomputes all 200 links plus the match probes.
export const ticksPerIteration = 8

export const benchOptions = {
  warmupIterations: 50,
  time: 10_000,
  throws: true,
}
