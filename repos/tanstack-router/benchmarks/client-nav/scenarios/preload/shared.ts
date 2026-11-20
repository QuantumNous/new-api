/**
 * Shared definition of the `preload` scenario: intent preloading via link
 * hover, programmatic `router.preloadRoute`, and commit-time preload-cache
 * maintenance. The router is configured with `defaultPreload: 'intent'`,
 * `defaultPreloadDelay: 0` (no wall-clock debounce timer) and
 * `defaultPreloadStaleTime: 0` — the default 30s wall-clock threshold would
 * flip cache-hit behavior mid-run; with 0 every hover re-runs the preload
 * work, keeping the loop stationary.
 *
 * Hover-intent preloading was verified manually per adapter (standalone jsdom
 * run inspecting the router's cached matches after dispatching `mouseover` on
 * a link). The harness hover step dispatches a single `mouseover`, which
 * triggers the preload pipeline exactly once in every adapter: React
 * synthesizes mouseEnter from it, Solid/Vue attach a native `mouseover`
 * handler. (Solid/Vue also listen to `mouseenter`; dispatching both events
 * would preload twice for them but once for React.)
 */
import type { ScenarioStep } from '../harness'

export const sections = ['a', 'b', 'c', 'd', 'e'] as const

export const SECTION_ITEM_COUNT = 30

/** Deterministic LCG stream seeded from a string — no Math.random. */
function seededValues(seedText: string, count: number) {
  let value = 0
  for (let i = 0; i < seedText.length; i++) {
    value = (value * 31 + seedText.charCodeAt(i)) >>> 0
  }

  const values: Array<number> = []
  for (let i = 0; i < count; i++) {
    value = (value * 1664525 + 1013904223) >>> 0
    values.push(value % 100_000)
  }
  return values
}

export interface SectionItem {
  name: string
  value: number
}

export function sectionItems(section: string): Array<SectionItem> {
  return seededValues(`section-${section}`, SECTION_ITEM_COUNT).map(
    (value, index) => ({
      name: `item-${section}-${index}`,
      value,
    }),
  )
}

export function sectionChecksum(section: string) {
  return sectionItems(section).reduce(
    (sum, item) => (sum + item.value) % 1_000_000_007,
    0,
  )
}

export function sectionMarker(section: string) {
  return `${section}:${sectionChecksum(section)}`
}

export const docsMarker = 'docs'
export const homeMarker = 'home'

interface StepDef {
  step: ScenarioStep
  /** Expected page marker after the step; undefined for non-navigation steps. */
  marker?: string
}

export const stepDefs: ReadonlyArray<StepDef> = [
  { step: { type: 'hover', testId: 's-a' } },
  { step: { type: 'hover', testId: 's-b' } },
  { step: 's-a', marker: sectionMarker('a') },
  { step: { type: 'hover', testId: 's-c' } },
  { step: 's-c', marker: sectionMarker('c') },
  {
    step: {
      type: 'preload',
      getOptions: () => ({
        to: '/sections/$section',
        params: { section: 'd' },
      }),
    },
  },
  { step: 's-d', marker: sectionMarker('d') },
  { step: { type: 'hover', testId: 's-e' } },
  { step: 'go-docs', marker: docsMarker },
  { step: 'go-home', marker: homeMarker },
]

export const scenarioSteps: ReadonlyArray<ScenarioStep> = stepDefs.map(
  (def) => def.step,
)

export function assertStepResult(stepIndex: number, container: HTMLElement) {
  const def = stepDefs[stepIndex]!
  if (!def.marker) {
    return
  }

  const marker = container.querySelector('[data-testid="page-state"]')
  if (marker?.textContent !== def.marker) {
    throw new Error(
      `Expected page marker "${def.marker}" after step ${stepIndex}, received "${marker?.textContent}"`,
    )
  }
}

// Two laps through the 10-step sequence per benchmark iteration.
export const ticksPerIteration = 20

export const benchOptions = {
  warmupIterations: 50,
  time: 10_000,
  throws: true,
}
