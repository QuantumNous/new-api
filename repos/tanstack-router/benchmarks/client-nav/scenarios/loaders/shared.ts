/**
 * Shared definition of the `loaders` scenario: deterministic loader data
 * derivation, the click sequence, and per-step sanity assertions. The three
 * framework apps consume these builders so the workload is identical modulo
 * the rendering layer.
 *
 * Isolates: client loader dispatch — always-stale re-runs (staleTime 0),
 * pure cache hits (staleTime 1e9), loaderDeps-keyed caching,
 * router.invalidate(), and useLoaderData selector subscriptions.
 */

import type { ScenarioStep } from '../harness'

export function computeChecksum(seed: number) {
  let value = Math.trunc(seed) | 0

  for (let index = 0; index < 40; index++) {
    value = (value * 1664525 + 1013904223 + index) >>> 0
  }

  return value
}

export interface LoaderItem {
  id: string
  name: string
  value: number
  flag: boolean
}

export function makeItems(seedText: string): Array<LoaderItem> {
  let seed = 0
  for (let index = 0; index < seedText.length; index++) {
    seed = (seed * 31 + seedText.charCodeAt(index)) >>> 0
  }

  const items: Array<LoaderItem> = []
  let value = seed

  for (let index = 0; index < 50; index++) {
    value = (value * 1664525 + 1013904223) >>> 0
    items.push({
      id: `${seedText}-${index}`,
      name: `Item ${index} of ${seedText}`,
      value: value % 100000,
      flag: value % 3 === 0,
    })
  }

  return items
}

export function itemsChecksum(items: Array<LoaderItem>) {
  let sum = 0
  for (const item of items) {
    sum = (sum + item.value + (item.flag ? 1 : 0)) >>> 0
  }
  return sum
}

export function normalizePage(value: unknown) {
  const page = Number(value)
  return Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1
}

export function freshMarkerText(id: string) {
  return `f-${id}-${itemsChecksum(makeItems(`fresh-${id}`))}`
}

export function cachedMarkerText(id: string) {
  return `c-${id}-${itemsChecksum(makeItems(`cached-${id}`))}`
}

export function depsMarkerText(page: number) {
  return `d-${page}-${itemsChecksum(makeItems(`deps-${page}`))}`
}

export const steps: ReadonlyArray<ScenarioStep> = [
  'go-fresh-1',
  'go-fresh-2',
  'go-cached-1',
  'go-cached-2',
  'go-deps-1',
  'go-deps-2',
  // Invalidates the currently matched routes (the deps route), re-running its
  // loader with unchanged deps. Note: this also marks the cached fresh/cached
  // matches invalid, so each of those loaders re-runs once per lap on its next
  // visit — deterministic, identical work every lap.
  { type: 'invalidate' },
  'go-home',
]

interface ExpectedState {
  testId: string
  text?: string
}

const expectedStates: ReadonlyArray<ExpectedState> = [
  { testId: 'fresh-state', text: freshMarkerText('1') },
  { testId: 'fresh-state', text: freshMarkerText('2') },
  { testId: 'cached-state', text: cachedMarkerText('1') },
  { testId: 'cached-state', text: cachedMarkerText('2') },
  { testId: 'deps-state', text: depsMarkerText(1) },
  { testId: 'deps-state', text: depsMarkerText(2) },
  // After invalidate the deps loader re-ran with the same deps.
  { testId: 'deps-state', text: depsMarkerText(2) },
  { testId: 'home-state' },
]

export function assertStepResult(stepIndex: number, container: HTMLElement) {
  const expected = expectedStates[stepIndex]!
  const element = container.querySelector(`[data-testid="${expected.testId}"]`)

  if (!element) {
    throw new Error(
      `Expected marker "${expected.testId}" to exist after step ${stepIndex}`,
    )
  }

  if (expected.text !== undefined && element.textContent !== expected.text) {
    throw new Error(
      `Expected marker "${expected.testId}" to read "${expected.text}" after step ${stepIndex}, received "${element.textContent}"`,
    )
  }
}

// Two laps through the 8-step sequence per benchmark iteration.
export const ticksPerIteration = 16

export const benchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}
