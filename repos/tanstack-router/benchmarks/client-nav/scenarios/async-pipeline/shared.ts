/**
 * Shared definition of the `async-pipeline` scenario: the router's async
 * load pipeline — fully async loaders (transition-held navigations), async
 * `beforeLoad` context building, and parallel nested async loaders. All async
 * work resolves through counted 0ms timer hops so the workload is
 * deterministic. The three framework apps consume these builders so the
 * workload is identical modulo the rendering layer.
 *
 * Note: component-level deferred consumption (`Await`/Suspense) is
 * intentionally NOT covered. React throttles every Suspense reveal (with or
 * without a fallback, including `pendingComponent`) by ~300ms of wall-clock
 * time, which cannot be made deterministic; the async work is exercised
 * through the router's own pipeline instead.
 */
import type { ScenarioStep } from '../harness'

/**
 * Resolves after exactly `hops` chained macrotask turns. Uses `setImmediate`
 * rather than `setTimeout(0)`: both are counted, deterministic event-loop
 * turns, but timers cost ~3-4 syscalls per hop (timerfd + epoll) and CodSpeed
 * excludes syscall time from the measure — inconsistently past a threshold —
 * which destabilized the hop-heavy benches.
 */
export function hopDelay(hops: number): Promise<void> {
  let promise = Promise.resolve()
  for (let i = 0; i < hops; i++) {
    promise = promise.then(
      () => new Promise<void>((resolve) => setImmediate(() => resolve())),
    )
  }
  return promise
}

/** Number of 0ms hops every async loader/beforeLoad takes before resolving. */
export const deferredHops = 2

function checksum(seed: number) {
  let value = seed | 0
  for (let index = 0; index < 20; index++) {
    value = (value * 1664525 + 1013904223 + index) >>> 0
  }
  return value
}

export function slowStateValue(id: string) {
  return `state-${id}-${checksum(Number(id) * 71 + 3)}`
}

export function ctxSeedValue(id: string) {
  return checksum(Number(id) * 13 + 1)
}

export function ctxStateValue(id: string) {
  return `ctx-${id}-${checksum(ctxSeedValue(id) + 5)}`
}

export function nestedLayoutValue() {
  return `layout-${checksum(97)}`
}

export function nestedStateValue(id: string) {
  return `nested-${id}-${checksum(Number(id) * 41 + 11)}`
}

function markerText(testId: string) {
  return (
    document.querySelector(`[data-testid="${testId}"]`)?.textContent ??
    undefined
  )
}

function step(testId: string, isSettled: () => boolean): ScenarioStep {
  return { type: 'click', testId, isSettled }
}

export const steps: ReadonlyArray<ScenarioStep> = [
  step('go-slow-1', () => markerText('slow-state') === slowStateValue('1')),
  step('go-ctx-1', () => markerText('ctx-state') === ctxStateValue('1')),
  step(
    'go-nested-1',
    () =>
      markerText('nested-layout') === nestedLayoutValue() &&
      markerText('nested-state') === nestedStateValue('1'),
  ),
  step('go-slow-2', () => markerText('slow-state') === slowStateValue('2')),
  step('go-ctx-2', () => markerText('ctx-state') === ctxStateValue('2')),
  step(
    'go-nested-2',
    () => markerText('nested-state') === nestedStateValue('2'),
  ),
  step('go-home', () => markerText('home-state') === 'home'),
]

export function assertStepResult(stepIndex: number) {
  const current = steps[stepIndex]!
  if (typeof current === 'string' || !('isSettled' in current)) {
    return
  }
  if (!current.isSettled!()) {
    throw new Error(
      `Unexpected document state after async-pipeline step ${stepIndex}`,
    )
  }
}

// Two laps through the 7-step sequence per benchmark iteration.
export const ticksPerIteration = 14

export const benchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}
