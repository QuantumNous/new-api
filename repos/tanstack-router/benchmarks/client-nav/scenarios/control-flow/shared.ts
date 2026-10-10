/**
 * Shared definition of the `control-flow` scenario: loader-thrown redirects
 * (including a 2-hop chain), notFound() rendering, loader errors through the
 * route error boundary, and recovery navigation resetting the boundary.
 */
import type { ScenarioStep } from '../harness'

export const errorMessage = 'bench-error'

export const steps: ReadonlyArray<ScenarioStep> = [
  {
    type: 'click',
    testId: 'go-hop1',
    // The click lands on /hop1 whose loader chains redirects to /target; wait
    // until the post-redirect location is committed before finishing the step.
    isSettled: () =>
      document.querySelector('[data-testid="loc"]')?.textContent === '/target',
  },
  'go-missing-ok',
  'go-missing-gone',
  'go-broken',
  'go-target',
  'go-missing-gone',
  'home',
]

interface StepExpectation {
  loc: string
  present: ReadonlyArray<string>
  absent?: ReadonlyArray<string>
  errorText?: string
}

const expectations: ReadonlyArray<StepExpectation> = [
  { loc: '/target', present: ['target-state'] },
  { loc: '/missing/exists', present: ['missing-state'] },
  {
    loc: '/missing/gone',
    present: ['not-found-state'],
    absent: ['missing-state'],
  },
  { loc: '/broken', present: ['error-state'], errorText: errorMessage },
  { loc: '/target', present: ['target-state'], absent: ['error-state'] },
  { loc: '/missing/gone', present: ['not-found-state'] },
  { loc: '/', present: ['home-state'] },
]

export function assertStepResult(stepIndex: number, container: HTMLElement) {
  const expectation = expectations[stepIndex % expectations.length]!

  const loc = container.querySelector('[data-testid="loc"]')
  if (loc?.textContent !== expectation.loc) {
    throw new Error(
      `Expected location "${expectation.loc}" after step ${stepIndex}, received "${loc?.textContent ?? '<missing>'}"`,
    )
  }

  for (const testId of expectation.present) {
    const element = container.querySelector(`[data-testid="${testId}"]`)
    if (!element) {
      throw new Error(
        `Expected [data-testid="${testId}"] after step ${stepIndex}`,
      )
    }
    if (
      expectation.errorText &&
      !element.textContent?.includes(expectation.errorText)
    ) {
      throw new Error(
        `Expected [data-testid="${testId}"] to include "${expectation.errorText}", received "${element.textContent}"`,
      )
    }
  }

  for (const testId of expectation.absent ?? []) {
    if (container.querySelector(`[data-testid="${testId}"]`)) {
      throw new Error(
        `Expected [data-testid="${testId}"] to be absent after step ${stepIndex}`,
      )
    }
  }
}

// Two laps through the 7-step sequence per benchmark iteration.
export const ticksPerIteration = 14

export const benchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}
