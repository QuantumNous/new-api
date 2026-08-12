import {
  createDeterministicRandom,
  randomSegment,
} from '#memory-client/bench-utils'
import {
  createBenchContainer,
  drainMicrotasks,
  nextAnimationFrame,
  noop,
  removeBenchContainer,
  warnClientMemoryDevMode,
} from '#memory-client/lifecycle'
import type { Framework, MountTestApp } from '#memory-client/lifecycle'

type GetTrackedItemLoaderCount = (id: string) => number

type PreloadRouter = {
  load: () => Promise<void>
  preloadRoute: (options: {
    to: '/items/$id'
    params: { id: string }
  }) => Promise<unknown>
  navigate: (
    options:
      | {
          to: '/items/$id'
          params: { id: string }
          replace: true
        }
      | {
          to: '/'
          replace: true
        },
  ) => Promise<void>
  subscribe: (event: 'onRendered', listener: () => void) => () => void
}

// Fixed id for the eviction navigations interleaved into the bench loop; its
// payload is a constant-size steady-state resident, never part of the signal.
const evictionItemId = 'nav-evict'
const preloadChurnIterations = 200
// A navigation commit is what triggers the router's clearExpiredCache --
// preloaded matches (defaultPreloadGcTime: 0) are only evicted then, never
// during a preload-only loop. Interleaving a navigation every few preloads is
// what makes the flat floor assert "eviction releases preloaded payloads".
const preloadsPerEvictionNavigation = 10
// Module-level so ids stay unique across runner invocations on one mount; a
// per-invocation LCG would replay identical ids, and every preload after the
// first invocation would dedupe against cachedMatches instead of doing work.
const benchmarkRandom = createDeterministicRandom(0x706c6f61)
let preloadCounter = 0

const uninitialized = async (_id: string) => {
  throw new Error('preload-churn benchmark is not initialized')
}

export function createWorkload(
  framework: Framework,
  mountTestApp: MountTestApp,
  getTrackedItemLoaderCount: GetTrackedItemLoaderCount,
) {
  warnClientMemoryDevMode(framework)

  let container: HTMLDivElement | undefined = undefined
  let router: PreloadRouter | undefined = undefined
  let unmount = noop
  let unsub = noop
  let resolveRendered = noop
  let evictionParity = 0
  let preloadItem: (id: string) => Promise<void> = uninitialized
  let navigateToItem: (id: string) => Promise<void> = uninitialized
  let navigateToIndex: () => Promise<void> = () =>
    uninitialized('navigate-to-index')

  function assertRenderedIndex() {
    const actual =
      container?.querySelector<HTMLElement>('[data-bench-page]')?.dataset
        .benchPage

    if (actual !== 'index') {
      throw new Error(`Expected rendered index page, got ${actual}`)
    }
  }

  async function waitForRenderedIndex() {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        assertRenderedIndex()
        return
      } catch {
        await nextAnimationFrame()
      }
    }

    assertRenderedIndex()
  }

  function waitForNextRender() {
    return new Promise<void>((resolve) => {
      resolveRendered = resolve
    })
  }

  async function before() {
    if (container) {
      after()
    }

    container = createBenchContainer()

    const mounted = mountTestApp(container)
    router = mounted.router as PreloadRouter
    unmount = mounted.unmount

    unsub = router.subscribe('onRendered', () => {
      resolveRendered()
    })

    preloadItem = async (id) => {
      await router!.preloadRoute({
        to: '/items/$id',
        params: { id },
      })
      await drainMicrotasks()
    }

    navigateToItem = async (id) => {
      const rendered = waitForNextRender()
      await Promise.all([
        router!.navigate({
          to: '/items/$id',
          params: { id },
          replace: true,
        }),
        rendered,
      ])
    }

    navigateToIndex = async () => {
      const rendered = waitForNextRender()
      await Promise.all([
        router!.navigate({
          to: '/',
          replace: true,
        }),
        rendered,
      ])
    }

    await router.load()
    await waitForRenderedIndex()
  }

  function after() {
    unmount()
    removeBenchContainer(container)
    unsub()

    container = undefined
    router = undefined
    unmount = noop
    unsub = noop
    resolveRendered = noop
    evictionParity = 0
    preloadItem = uninitialized
    navigateToItem = uninitialized
    navigateToIndex = () => uninitialized('navigate-to-index')
  }

  // Alternate between two distinct locations so every eviction navigation
  // changes the href (a same-href navigate would never commit or render).
  async function evictPreloads() {
    evictionParity = (evictionParity + 1) % 2

    if (evictionParity === 1) {
      await navigateToItem(evictionItemId)
    } else {
      await navigateToIndex()
    }
  }

  return {
    name: `mem preload-churn (${framework})`,
    before,
    preload: (id: string) => preloadItem(id),
    evictPreloads,
    async run() {
      for (let index = 0; index < preloadChurnIterations; index++) {
        await preloadItem(
          `${(preloadCounter++).toString(36)}-${randomSegment(benchmarkRandom)}`,
        )

        if ((index + 1) % preloadsPerEvictionNavigation === 0) {
          await evictPreloads()
        }
      }
    },
    async sanity() {
      await before()

      try {
        assertRenderedIndex()

        const id = 'sanity-preloaded-item'
        const initialLoaderCount = getTrackedItemLoaderCount(id)
        await preloadItem(id)

        const preloadedLoaderCount = getTrackedItemLoaderCount(id)
        if (preloadedLoaderCount !== initialLoaderCount + 1) {
          throw new Error(
            `Expected preload to run item loader once, got ${preloadedLoaderCount - initialLoaderCount}`,
          )
        }
      } finally {
        after()
      }
    },
    after,
  }
}
