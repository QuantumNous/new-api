/**
 * Shared definition of the `nested-params` scenario: deep dynamic nesting with
 * per-level params.parse/stringify, beforeLoad context accumulation, and
 * useParams/useRouteContext subscribers at every level. The three framework
 * apps consume these builders so the workload is identical modulo the
 * rendering layer.
 */

export interface LeafParams {
  a: string
  b: string
  c: string
  d: string
  e: string
  f: string
  g: string
  h: string
}

// Several values need percent-encoding in the URL (spaces, `&`, `%`, `+`,
// unicode) so every navigation exercises the param encode/decode paths, not
// just plain-ASCII interpolation.
const baseParams: LeafParams = {
  a: 'alpha',
  b: 'bravo & co',
  c: 'charlie 100%',
  d: 'delta',
  e: 'écho-café',
  f: 'foxtrot+one',
  g: 'golf',
  h: 'hôtel',
}

/**
 * set 0: base; set 1: only the deepest param differs (only the leaf re-runs);
 * set 2: a mid param differs (levels d..h re-run); set 3: the top param
 * differs (every level re-runs).
 */
export const leafParamSets: ReadonlyArray<LeafParams> = [
  baseParams,
  { ...baseParams, h: 'hilton' },
  { ...baseParams, d: 'dover' },
  { ...baseParams, a: 'axel' },
]

export const midParams = {
  a: baseParams.a,
  b: baseParams.b,
  c: baseParams.c,
  d: baseParams.d,
}

export function normalizeParam(value: unknown) {
  const raw = String(value)
  return raw.length > 24 ? raw.slice(0, 24) : raw
}

export function smallHash(value: string | number) {
  const input = `${value}`
  let hash = 5381
  for (let index = 0; index < input.length; index++) {
    hash = ((hash * 33) ^ input.charCodeAt(index)) >>> 0
  }
  return hash
}

export function leafMarker(params: LeafParams) {
  return [
    params.a,
    params.b,
    params.c,
    params.d,
    params.e,
    params.f,
    params.g,
    params.h,
  ]
    .map(normalizeParam)
    .join('.')
}

export function midMarker(params: typeof midParams) {
  return [params.a, params.b, params.c, params.d].map(normalizeParam).join('.')
}

export const steps = [
  'leaf-1',
  'leaf-2',
  'leaf-3',
  'leaf-4',
  'mid-4',
  'home',
] as const

function requireText(container: HTMLElement, testId: string, expected: string) {
  const element = container.querySelector(`[data-testid="${testId}"]`)
  if (!element || element.textContent !== expected) {
    throw new Error(
      `Expected [data-testid="${testId}"] to render "${expected}", received "${element?.textContent ?? '<missing>'}"`,
    )
  }
}

function requireAbsent(container: HTMLElement, testId: string) {
  if (container.querySelector(`[data-testid="${testId}"]`)) {
    throw new Error(`Expected [data-testid="${testId}"] to be absent`)
  }
}

export function assertStepResult(stepIndex: number, container: HTMLElement) {
  const step = steps[stepIndex % steps.length]!
  switch (step) {
    case 'leaf-1':
      requireText(container, 'leaf-state', leafMarker(leafParamSets[0]!))
      break
    case 'leaf-2':
      requireText(container, 'leaf-state', leafMarker(leafParamSets[1]!))
      break
    case 'leaf-3':
      requireText(container, 'leaf-state', leafMarker(leafParamSets[2]!))
      break
    case 'leaf-4':
      requireText(container, 'leaf-state', leafMarker(leafParamSets[3]!))
      break
    case 'mid-4':
      requireAbsent(container, 'leaf-state')
      requireText(container, 'mid-state', midMarker(midParams))
      break
    case 'home':
      requireAbsent(container, 'leaf-state')
      requireAbsent(container, 'mid-state')
      break
  }
}

// Three laps through the 6-step sequence per benchmark iteration.
export const ticksPerIteration = 18

export const benchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}
