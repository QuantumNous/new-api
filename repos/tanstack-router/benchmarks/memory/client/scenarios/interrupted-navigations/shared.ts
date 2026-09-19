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

type NavigationSettlement =
  | {
      status: 'fulfilled'
      value: void
    }
  | {
      status: 'rejected'
      reason: unknown
    }

type ResolveAllSlowLoaders = () => void
type ResolveSlowLoader = (id: string) => void
type SlowLoaderRegistry = {
  has: (id: string) => boolean
}

type RenderedEvent = {
  toLocation: {
    pathname: string
  }
}

type InterruptedNavigationRouter = {
  latestLoadPromise: Promise<void> | undefined
  load: () => Promise<void>
  navigate: (options: {
    to: '/fast/$id' | '/slow/$id'
    params: { id: string }
    replace: true
  }) => Promise<void>
  subscribe: (
    event: 'onRendered',
    listener: (event: RenderedEvent) => void,
  ) => () => void
}

const interruptedNavigationIterations = 150
const interruptedNavigationPairs = createInterruptedNavigationPairs(
  interruptedNavigationIterations,
)

const uninitialized = () =>
  Promise.reject(
    new Error('interrupted-navigations benchmark is not initialized'),
  )

const uninitializedSettlement = () =>
  Promise.resolve<NavigationSettlement>({
    status: 'rejected',
    reason: new Error('interrupted-navigations benchmark is not initialized'),
  })

function createInterruptedNavigationPairs(iterations: number) {
  const random = createDeterministicRandom(13)

  return Array.from({ length: iterations }, (_, index) => ({
    slowId: `slow-${index}-${randomSegment(random)}`,
    fastId: `fast-${index}-${randomSegment(random)}`,
  }))
}

function formatReason(reason: unknown) {
  if (reason instanceof Error) {
    return `${reason.name}: ${reason.message}`
  }

  return String(reason)
}

function assertSlowNavigationSettlement(settlement: NavigationSettlement) {
  if (settlement.status === 'fulfilled') {
    if (settlement.value !== undefined) {
      throw new Error('Expected slow navigation to fulfill with undefined')
    }

    return
  }

  if (
    reasonHasAbortShape(settlement.reason) ||
    reasonHasCancellationShape(settlement.reason)
  ) {
    return
  }

  throw new Error(
    `Expected slow navigation to settle as void or cancellation, got ${formatReason(
      settlement.reason,
    )}`,
  )
}

async function awaitExpectedLoadSettlement(loadPromise: Promise<void>) {
  try {
    await loadPromise
  } catch (reason) {
    if (reasonHasAbortShape(reason) || reasonHasCancellationShape(reason)) {
      return
    }

    throw reason
  }
}

function reasonHasAbortShape(reason: unknown) {
  return reason instanceof DOMException && reason.name === 'AbortError'
}

function reasonHasCancellationShape(reason: unknown) {
  return (
    reason instanceof Error &&
    (reason.name === 'AbortError' || reason.name === 'CancelledError')
  )
}

export function createWorkload(
  framework: Framework,
  mountTestApp: MountTestApp,
  resolveAllSlowLoaders: ResolveAllSlowLoaders,
  resolveSlowLoader: ResolveSlowLoader,
  slowLoaderRegistry: SlowLoaderRegistry,
) {
  warnClientMemoryDevMode(framework)

  let container: HTMLDivElement | undefined = undefined
  let unmount = noop
  let unsub = noop
  let resolveRendered: () => void = noop
  let expectedRenderedPath: string | undefined = undefined
  let navigateFast: (id: string) => Promise<void> = uninitialized
  let startSlowNavigation: (id: string) => Promise<NavigationSettlement> =
    uninitializedSettlement
  let getLatestLoadPromise: () => Promise<void> | undefined = () => undefined

  function assertRenderedPage(page: 'shell' | 'fast', id?: string) {
    const element = container?.querySelector<HTMLElement>('[data-bench-page]')
    const actualPage = element?.dataset.benchPage
    const actualId = element?.dataset.benchId

    if (actualPage !== page) {
      throw new Error(`Expected rendered page ${page}, got ${actualPage}`)
    }

    if (id !== undefined && actualId !== id) {
      throw new Error(`Expected rendered id ${id}, got ${actualId}`)
    }
  }

  async function waitForRenderedPage(page: 'shell' | 'fast', id?: string) {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        assertRenderedPage(page, id)
        return
      } catch {
        await nextAnimationFrame()
      }
    }

    assertRenderedPage(page, id)
  }

  async function waitForSlowLoader(id: string) {
    for (let attempt = 0; attempt < 20; attempt++) {
      if (slowLoaderRegistry.has(id)) {
        return
      }

      await drainMicrotasks()
    }

    throw new Error(`Slow loader was not registered for id: ${id}`)
  }

  function waitForNextRender(pathname: string) {
    expectedRenderedPath = pathname

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
    const router = mounted.router as InterruptedNavigationRouter
    unmount = mounted.unmount
    getLatestLoadPromise = () => router.latestLoadPromise

    unsub = router.subscribe('onRendered', (event) => {
      if (
        expectedRenderedPath &&
        event.toLocation.pathname !== expectedRenderedPath
      ) {
        return
      }

      const resolve = resolveRendered
      resolveRendered = noop
      expectedRenderedPath = undefined
      resolve()
    })

    navigateFast = async (id) => {
      const rendered = waitForNextRender(`/fast/${id}`)
      await Promise.all([
        router.navigate({
          to: '/fast/$id',
          params: { id },
          replace: true,
        }),
        rendered,
      ])
    }

    startSlowNavigation = (id) => {
      const navigation = router.navigate({
        to: '/slow/$id',
        params: { id },
        replace: true,
      })

      return navigation
        .then((value): NavigationSettlement => ({ status: 'fulfilled', value }))
        .catch(
          (reason: unknown): NavigationSettlement => ({
            status: 'rejected',
            reason,
          }),
        )
    }

    await router.load()
    await waitForRenderedPage('shell')
  }

  function after() {
    resolveAllSlowLoaders()
    unmount()
    removeBenchContainer(container)
    unsub()

    container = undefined
    unmount = noop
    unsub = noop
    resolveRendered = noop
    expectedRenderedPath = undefined
    navigateFast = uninitialized
    startSlowNavigation = uninitializedSettlement
    getLatestLoadPromise = () => undefined
  }

  async function interrupt(
    slowId: string,
    fastId: string,
    assertSettlement = true,
  ) {
    const slowNavigation = startSlowNavigation(slowId)

    await waitForSlowLoader(slowId)
    const slowLoadPromise = getLatestLoadPromise()

    if (!slowLoadPromise) {
      throw new Error(`Slow navigation did not start a load for id: ${slowId}`)
    }

    await navigateFast(fastId)
    resolveSlowLoader(slowId)

    const settlement = await slowNavigation

    if (assertSettlement) {
      assertSlowNavigationSettlement(settlement)
    }

    await awaitExpectedLoadSettlement(slowLoadPromise)
    await drainMicrotasks()
  }

  return {
    name: `mem client interrupted-navigations (${framework})`,
    before,
    interrupt,
    async run() {
      for (const pair of interruptedNavigationPairs) {
        await interrupt(pair.slowId, pair.fastId)
      }
    },
    async sanity() {
      await before()

      try {
        assertRenderedPage('shell')
        await interrupt('sanity-slow', 'sanity-fast', false)
        assertRenderedPage('fast', 'sanity-fast')
      } finally {
        after()
      }
    },
    after,
  }
}
