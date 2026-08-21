/**
 * Shared definition of the `mount` scenario: cold start of a moderate,
 * realistic app — router creation (processRouteTree), first render, initial
 * `router.load()`, and unmount. This is the only scenario where router
 * construction is inside the measured loop; the wider tree exists as
 * realistic route-processing weight even though only the index route loads.
 */

export const readyTestId = 'mount-ready'

export const homeItemCount = 5

export function homeItems() {
  return Array.from({ length: homeItemCount }, (_, index) => ({
    id: `item-${index}`,
    label: `Featured item ${index}`,
    score: index * 17 + 3,
  }))
}

export const homeReadyText = `Home (${homeItemCount} items)`

export function shopContext() {
  return { shopSeed: 7 }
}

export function blogContext() {
  return { blogSeed: 13 }
}

export function productData(productId: string) {
  return {
    id: productId,
    name: `Product ${productId}`,
    price: productId.length * 100 + 42,
  }
}

export function articleData(slug: string) {
  return {
    slug,
    title: `Article ${slug}`,
    words: slug.length * 250,
  }
}

export function normalizePage(value: unknown) {
  const page = Number(value)
  return Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1
}

export function normalizeQuery(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function assertReady(container: HTMLElement) {
  const marker = container.querySelector(`[data-testid="${readyTestId}"]`)
  if (marker?.textContent !== homeReadyText) {
    throw new Error(
      `Expected mount marker to be "${homeReadyText}", received "${marker?.textContent}"`,
    )
  }
}

// Mounts per benchmark iteration.
// 6 mounts per iteration: a single mount simulates to only ~8ms of CPU, and
// very short measures amplify the relative impact of allocator/GC
// quantization; 6 keeps the measure comfortably above ~50ms simulated.
export const ticksPerIteration = 6

export const benchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}
