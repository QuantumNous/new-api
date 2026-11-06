/**
 * Shared definition of the `search-params` scenario: search schema
 * normalizers, the click sequence, and per-step sanity assertions. The three
 * framework apps consume these builders so the workload is identical modulo
 * the rendering layer.
 *
 * Isolates: validateSearch execution, search middlewares
 * (retainSearchParams/stripSearchParams), parse/stringify of medium-complex
 * search objects, functional search updaters, structural sharing, and
 * useSearch selector subscriptions.
 */

import type { ScenarioStep } from '../harness'

export function computeChecksum(seed: number) {
  let value = Math.trunc(seed) | 0

  for (let index = 0; index < 40; index++) {
    value = (value * 1664525 + 1013904223 + index) >>> 0
  }

  return value
}

export interface ProductsSearch {
  page: number
  perPage: number
  sort: 'asc' | 'desc'
  q: string
  filters: {
    categories: Array<string>
    price: { min: number; max: number }
    tags: Array<string>
  }
}

export interface CatalogSearch {
  view: 'grid' | 'list'
  page: number
  perPage: number
  sort: 'asc' | 'desc'
}

function normalizeNumber(value: unknown, fallback: number) {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0 ? Math.trunc(num) : fallback
}

function normalizeString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback
}

function normalizeSort(value: unknown): 'asc' | 'desc' {
  return value === 'desc' ? 'desc' : 'asc'
}

function normalizeStringArray(value: unknown): Array<string> {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((entry): entry is string => typeof entry === 'string')
}

export function normalizeProductsSearch(
  search: Record<string, unknown>,
): ProductsSearch {
  const filters =
    typeof search.filters === 'object' && search.filters !== null
      ? (search.filters as Record<string, unknown>)
      : {}
  const price =
    typeof filters.price === 'object' && filters.price !== null
      ? (filters.price as Record<string, unknown>)
      : {}

  return {
    page: Math.max(1, normalizeNumber(search.page, 1)),
    perPage: Math.max(1, normalizeNumber(search.perPage, 20)),
    sort: normalizeSort(search.sort),
    q: normalizeString(search.q, ''),
    filters: {
      categories: normalizeStringArray(filters.categories),
      price: {
        min: normalizeNumber(price.min, 0),
        max: normalizeNumber(price.max, 1000),
      },
      tags: normalizeStringArray(filters.tags),
    },
  }
}

export function normalizeCatalogSearch(
  search: Record<string, unknown>,
): CatalogSearch {
  return {
    view: search.view === 'list' ? 'list' : 'grid',
    page: Math.max(1, normalizeNumber(search.page, 1)),
    perPage: Math.max(1, normalizeNumber(search.perPage, 20)),
    sort: normalizeSort(search.sort),
  }
}

export const initialProductsSearch = {
  page: 2,
  perPage: 50,
  sort: 'desc',
  q: 'gadget',
  filters: {
    categories: ['audio', 'video'],
    price: { min: 10, max: 200 },
    tags: ['new', 'sale'],
  },
} satisfies ProductsSearch

export const changedCategories = ['x-ray', 'yield', 'zeta']

export function productsMarkerText(search: ProductsSearch) {
  return `${search.page}|${search.sort}|${search.filters.categories.join(',')}`
}

export function catalogMarkerText(search: CatalogSearch) {
  return `${search.view}|${search.page}|${search.perPage}|${search.sort}`
}

export function productsLoaderChecksum(deps: {
  page: number
  sort: string
  filters: ProductsSearch['filters']
}) {
  return computeChecksum(
    deps.page * 31 +
      deps.sort.length * 7 +
      deps.filters.categories.join('').length * 13 +
      deps.filters.tags.length * 3 +
      (deps.filters.price.max - deps.filters.price.min),
  )
}

export const steps: ReadonlyArray<ScenarioStep> = [
  'go-products',
  'products-next-page',
  'products-categories',
  'products-sort',
  'products-reset',
  'go-catalog',
  'catalog-next-page',
  'products-partial',
  'go-home',
]

interface ExpectedState {
  testId: string
  text?: string
}

const expectedStates: ReadonlyArray<ExpectedState> = [
  // Full search literal from home.
  { testId: 'products-state', text: '2|desc|audio,video' },
  // Functional updater bumping the page.
  { testId: 'products-state', text: '3|desc|audio,video' },
  // Functional updater replacing filters.categories.
  { testId: 'products-state', text: '3|desc|x-ray,yield,zeta' },
  // Functional updater flipping sort desc -> asc.
  { testId: 'products-state', text: '3|asc|x-ray,yield,zeta' },
  // Functional updater resetting page to 1 (stripSearchParams removes it).
  { testId: 'products-state', text: '1|asc|x-ray,yield,zeta' },
  // search: true carries the current products search into catalog.
  { testId: 'catalog-state', text: 'grid|1|50|asc' },
  // Functional updater bumping the catalog page.
  { testId: 'catalog-state', text: 'grid|2|50|asc' },
  // Partial search literal; retainSearchParams fills perPage/sort from catalog.
  { testId: 'products-state', text: '1|asc|' },
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

// Two laps through the 9-step sequence per benchmark iteration.
export const ticksPerIteration = 18

export const benchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}
