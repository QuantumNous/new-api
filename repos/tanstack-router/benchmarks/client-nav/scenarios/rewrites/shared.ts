/**
 * Shared definition of the `rewrites` scenario: composed client-side location
 * rewrites — router `basepath` plus a locale input/output rewrite (the client
 * analog of the SSR `rewrites` scenario). Externally URLs look like
 * `/app/{locale}/p/...`; internally the router sees `/p/...` with the locale
 * carried in the `_locale` search param. Every navigation runs the composed
 * output rewrite when building hrefs/committing and the input rewrite when
 * parsing the committed location.
 */
import type { ScenarioStep } from '../harness'

export const basepath = '/app'
export const defaultLocale = 'en'

const localePrefixRe = /^\/(fr|de|es)(\/.*)$/

// Framework-agnostic rewrite pair consumed by all three apps' createRouter.
export const localeRewrite = {
  input: ({ url }: { url: URL }) => {
    const match = url.pathname.match(localePrefixRe)

    if (match) {
      url.pathname = match[2]!
      url.searchParams.set('_locale', match[1]!)
      return url
    }

    return undefined
  },
  output: ({ url }: { url: URL }) => {
    const locale = url.searchParams.get('_locale')

    if (locale) {
      url.searchParams.delete('_locale')
      url.pathname = `/${locale}${url.pathname}`
    }

    return url
  },
}

export function sectionLabel(a: string) {
  return `Section ${a}`
}

export function itemLabel(a: string, b: string) {
  return `Item ${a}/${b}`
}

interface StepDef {
  testId: string
  /** Internal router pathname expected after the step. */
  routerPath: string
  /** External window.location pathname expected after the step. */
  windowPath: string
}

// Circular lap: alternates sections, depths, and locales so every step runs
// the composed rewrites in both directions, then returns to the start.
export const stepDefs: ReadonlyArray<StepDef> = [
  { testId: 'go-x', routerPath: '/p/x', windowPath: '/app/p/x' },
  { testId: 'go-x-1-fr', routerPath: '/p/x/1', windowPath: '/app/fr/p/x/1' },
  { testId: 'go-y-de', routerPath: '/p/y', windowPath: '/app/de/p/y' },
  { testId: 'go-y-2', routerPath: '/p/y/2', windowPath: '/app/p/y/2' },
  { testId: 'go-x-es', routerPath: '/p/x', windowPath: '/app/es/p/x' },
  { testId: 'go-home', routerPath: '/', windowPath: '/app/' },
] as const

export const steps: ReadonlyArray<ScenarioStep> = stepDefs.map(
  (step) => step.testId,
)

export function assertStepResult(stepIndex: number, container: HTMLElement) {
  const expected = stepDefs[stepIndex]!
  const marker = container.querySelector('[data-testid="loc"]')
  const routerPath = marker?.textContent

  if (routerPath !== expected.routerPath) {
    throw new Error(
      `Expected router pathname "${expected.routerPath}" after step ${stepIndex}, received "${routerPath}"`,
    )
  }

  if (window.location.pathname !== expected.windowPath) {
    throw new Error(
      `Expected window pathname "${expected.windowPath}" after step ${stepIndex}, received "${window.location.pathname}"`,
    )
  }
}

// The app starts on the external root inside the basepath.
export const initialUrl = '/app'

// Three laps through the 6-step sequence per benchmark iteration.
export const ticksPerIteration = 18

export const benchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}
