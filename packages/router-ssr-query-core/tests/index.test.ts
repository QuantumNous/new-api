import { QueryClient } from '@tanstack/query-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setupCoreRouterSsrQueryIntegration } from '../src'

type TestRouter = {
  isServer: boolean
  options: {
    dehydrate?: () => unknown | Promise<unknown>
    hydrate?: (dehydrated: any) => unknown | Promise<unknown>
  }
  serverSsr?: {
    isDehydrated: () => boolean
    onRenderFinished: (listener: () => void) => void
    onCleanup: (listener: () => void) => void
  }
  serverSsrLifecycle?: {
    onServerSsrAttach: Array<
      (serverSsr: NonNullable<TestRouter['serverSsr']>) => void
    >
  }
}

type ServerRouterFixture = {
  router: TestRouter
  finishRender: () => void
  triggerCleanup: () => void
  attachServerSsr: () => void
  setDehydrated: (value: boolean) => void
  cleanupListenerCount: () => number
}

function createServerRouter(): ServerRouterFixture {
  const renderFinishedListeners = new Array<() => void>()
  const cleanupListeners = new Array<() => void>()
  let dehydrated = false
  const serverSsr = {
    isDehydrated: () => dehydrated,
    onRenderFinished: (listener: () => void) => {
      renderFinishedListeners.push(listener)
    },
    onCleanup: (listener: () => void) => {
      cleanupListeners.push(listener)
    },
  }

  const result: ServerRouterFixture = {
    router: {
      isServer: true,
      options: {},
      serverSsr,
    },
    finishRender: () => {
      renderFinishedListeners.splice(0).forEach((listener) => listener())
    },
    triggerCleanup: () => {
      cleanupListeners.splice(0).forEach((listener) => listener())
    },
    attachServerSsr: () => {
      result.router.serverSsr = serverSsr
      result.router.serverSsrLifecycle?.onServerSsrAttach.forEach(
        (listener) => {
          listener(serverSsr)
        },
      )
    },
    setDehydrated: (value: boolean) => {
      dehydrated = value
    },
    cleanupListenerCount: () => cleanupListeners.length,
  }

  return result
}

async function readStream<T>(stream: ReadableStream<T>): Promise<Array<T>> {
  const reader = stream.getReader()
  const chunks = new Array<T>()

  while (true) {
    const result = await reader.read()

    if (result.done) {
      return chunks
    }

    chunks.push(result.value)
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })

  return {
    promise,
    resolve,
  }
}

function createDehydratedQueryState(data: string) {
  return {
    data,
    dataUpdateCount: 1,
    dataUpdatedAt: 1,
    error: null,
    errorUpdateCount: 0,
    errorUpdatedAt: 0,
    fetchFailureCount: 0,
    fetchFailureReason: null,
    fetchMeta: null,
    fetchStatus: 'idle' as const,
    isInvalidated: false,
    status: 'success' as const,
  }
}

// Track QueryClients per-test and clear them in afterEach. Without this,
// queries created in tests keep their gcTime setTimeout handles open (5min
// default in jsdom), pinning QueryClient + QueryCache + this test's router
// alive across the whole suite. cancelQueries() + clear() drops them.
const trackedQueryClients = new Set<QueryClient>()
function track<T extends QueryClient>(client: T): T {
  trackedQueryClients.add(client)
  return client
}

afterEach(() => {
  vi.clearAllMocks()
  for (const client of trackedQueryClients) {
    try {
      client.cancelQueries()
    } catch {
      // ignore
    }
    try {
      client.clear()
    } catch {
      // ignore
    }
  }
  trackedQueryClients.clear()
})

describe('setupCoreRouterSsrQueryIntegration', () => {
  it('uses custom dehydrate options for the initial payload and streamed queries', async () => {
    const queryClient = track(new QueryClient())
    const { router, finishRender, attachServerSsr, setDehydrated } =
      createServerRouter()

    router.serverSsr = undefined
    setupCoreRouterSsrQueryIntegration({
      router: router as any,
      queryClient,
      dehydrateOptions: {
        serializeData: (data) => `${data}-serialized`,
        shouldDehydrateQuery: (query) => query.queryKey[0] !== 'skip',
      },
    })
    attachServerSsr()

    queryClient.setQueryData(['include'], 'initial')
    queryClient.setQueryData(['skip'], 'ignored')

    const dehydrated = (await router.options.dehydrate?.()) as {
      dehydratedQueryClient?: {
        queries: Array<{ queryKey: Array<unknown>; state: { data: unknown } }>
      }
      queryStream: ReadableStream<{
        queries: Array<{ queryKey: Array<unknown>; state: { data: unknown } }>
      }>
    }

    expect(dehydrated.dehydratedQueryClient?.queries).toHaveLength(1)
    expect(dehydrated.dehydratedQueryClient?.queries[0]?.queryKey).toEqual([
      'include',
    ])
    expect(dehydrated.dehydratedQueryClient?.queries[0]?.state.data).toBe(
      'initial-serialized',
    )

    const streamedQueriesPromise = readStream(dehydrated.queryStream)
    const includedDeferred = createDeferred<string>()
    const skippedDeferred = createDeferred<string>()

    setDehydrated(true)
    const includedPromise = queryClient.fetchQuery({
      queryKey: ['streamed'],
      queryFn: () => includedDeferred.promise,
    })
    const skippedPromise = queryClient.fetchQuery({
      queryKey: ['skip'],
      queryFn: () => skippedDeferred.promise,
    })

    await Promise.resolve()
    includedDeferred.resolve('next')
    skippedDeferred.resolve('still-ignored')
    await Promise.all([includedPromise, skippedPromise])
    finishRender()

    const streamedQueries = await streamedQueriesPromise

    expect(streamedQueries).toHaveLength(1)
    expect(streamedQueries[0]?.queries).toHaveLength(1)
    expect(streamedQueries[0]?.queries[0]?.queryKey).toEqual(['streamed'])
    expect(streamedQueries[0]?.queries[0]?.state.data).toBe('next-serialized')
  })

  it('uses custom hydrate options for the initial payload and streamed queries', async () => {
    const queryClient = track(new QueryClient())
    const router: TestRouter = {
      isServer: false,
      options: {},
    }

    setupCoreRouterSsrQueryIntegration({
      router: router as any,
      queryClient,
      hydrateOptions: {
        defaultOptions: {
          deserializeData: (data) => `${String(data)}-hydrated`,
        },
      },
    })

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue({
          mutations: [],
          queries: [
            {
              queryHash: '["streamed"]',
              queryKey: ['streamed'],
              state: createDehydratedQueryState('stream'),
            },
          ],
        })
        controller.close()
      },
    })

    await router.options.hydrate?.({
      dehydratedQueryClient: {
        mutations: [],
        queries: [
          {
            queryHash: '["initial"]',
            queryKey: ['initial'],
            state: createDehydratedQueryState('initial'),
          },
        ],
      },
      queryStream: stream,
    })

    await Promise.resolve()
    await Promise.resolve()

    expect(queryClient.getQueryData(['initial'])).toBe('initial-hydrated')
    expect(queryClient.getQueryData(['streamed'])).toBe('stream-hydrated')
  })
})

// GC reclamation tests are non-deterministic by nature (V8 makes no
// guarantee about WeakRef collection timing). Run them on demand only:
//   RUN_SSR_GC_TESTS=1 pnpm vitest
// The vite config gates --expose-gc on the same env var; outside of that
// gc() is unavailable and the describe is skipped.
const gcAvailable = typeof (globalThis as any).gc === 'function'
const gcTestsEnabled = process.env.RUN_SSR_GC_TESTS === '1' && gcAvailable

async function forceGc() {
  // Multiple passes; V8 may need several GC cycles to collect WeakRef
  // targets, especially with closure chains.
  for (let i = 0; i < 6; i++) {
    ;(globalThis as any).gc()
    await new Promise((r) => setTimeout(r, 0))
  }
}

// Reproduces TanStack/router#7402: per-request Router + QueryClient must be
// reclaimable by GC after SSR cleanup. Without the onCleanup teardown, the
// queryCache subscriber closure + gcTime setTimeout handles pin the
// QueryClient (and transitively the Router via router.context) for the full
// gcTime window (default 5min) per request.
describe.runIf(gcTestsEnabled)('SSR memory: GC reclamation', () => {
  it('queryClient + router are reclaimable after cleanup', async () => {
    let queryClient: QueryClient | null = new QueryClient({
      defaultOptions: { queries: { gcTime: 5 * 60 * 1000 } },
    })
    let serverRouter: ReturnType<typeof createServerRouter> | null =
      createServerRouter()

    serverRouter.router.serverSsr = undefined
    setupCoreRouterSsrQueryIntegration({
      router: serverRouter.router as any,
      queryClient,
    })
    serverRouter.attachServerSsr()

    // Populate cache w/ active gcTime timers (the leak anchor).
    queryClient.setQueryData(['a'], 'data-a')
    queryClient.setQueryData(['b'], 'data-b')

    // Run a full SSR cycle: dehydrate (registers onCleanup) -> finishRender.
    await serverRouter.router.options.dehydrate?.()
    serverRouter.setDehydrated(true)
    serverRouter.finishRender()

    const qcRef = new WeakRef(queryClient)
    const routerRef = new WeakRef(serverRouter.router)
    const cacheRef = new WeakRef(queryClient.getQueryCache())

    // Simulate full request teardown.
    serverRouter.triggerCleanup()

    // Drop all strong refs.
    queryClient = null
    serverRouter = null

    await forceGc()

    expect(qcRef.deref(), 'QueryClient should be GCd').toBeUndefined()
    expect(routerRef.deref(), 'Router should be GCd').toBeUndefined()
    expect(cacheRef.deref(), 'QueryCache should be GCd').toBeUndefined()
  })

  it('without cleanup, queryClient is retained (control)', async () => {
    let queryClient: QueryClient | null = new QueryClient({
      defaultOptions: { queries: { gcTime: 5 * 60 * 1000 } },
    })
    let serverRouter: ReturnType<typeof createServerRouter> | null =
      createServerRouter()

    serverRouter.router.serverSsr = undefined
    setupCoreRouterSsrQueryIntegration({
      router: serverRouter.router as any,
      queryClient,
    })
    serverRouter.attachServerSsr()

    queryClient.setQueryData(['a'], 'data-a')
    await serverRouter.router.options.dehydrate?.()

    const qcRef = new WeakRef(queryClient)

    // Drop strong refs WITHOUT triggering cleanup.
    queryClient = null
    serverRouter = null

    try {
      await forceGc()

      // Subscriber closure + gcTime timers keep it alive. This is the bug
      // we are guarding against; if this ever passes (returns undefined) the
      // production retention chain has changed and the cleanup-based test
      // above may also need re-validation.
      expect(qcRef.deref()).toBeDefined()
    } finally {
      // Avoid leaving the retained client + gcTime timers alive for up to
      // 5 minutes after the test finishes.
      qcRef.deref()?.clear()
    }
  })
})

// =====================================================================
// CI-stable cleanup behavior tests. These do not rely on GC timing; they
// assert the observable side-effects that make GC reclamation possible.
// =====================================================================
describe('SSR cleanup: deterministic behavior', () => {
  it('teardown runs when cleanup fires before dehydrate (loader redirect/error case)', async () => {
    const queryClient = track(new QueryClient())
    const { router, triggerCleanup, attachServerSsr, setDehydrated } =
      createServerRouter()

    router.serverSsr = undefined
    setupCoreRouterSsrQueryIntegration({
      router: router as any,
      queryClient,
    })
    attachServerSsr()

    // Cleanup registration happens when server SSR attaches, before loaders.
    setDehydrated(true)
    await queryClient.fetchQuery({
      queryKey: ['early'],
      queryFn: () => 'data',
    })

    expect(queryClient.getQueryData(['early'])).toBe('data')

    // Trigger cleanup as createRequestHandler's finally block would.
    triggerCleanup()

    // After cleanup the cache must be cleared (gcTime timers gone).
    expect(queryClient.getQueryData(['early'])).toBeUndefined()
  })

  it('cancels in-flight queries on cleanup (signal aborted)', async () => {
    const queryClient = track(new QueryClient())
    const { router, triggerCleanup, attachServerSsr, setDehydrated } =
      createServerRouter()

    router.serverSsr = undefined
    setupCoreRouterSsrQueryIntegration({
      router: router as any,
      queryClient,
    })
    attachServerSsr()
    setDehydrated(true)

    let observedAborted = false
    const queryStarted = createDeferred<void>()
    const inflight = queryClient.fetchQuery({
      queryKey: ['slow'],
      queryFn: ({ signal }) =>
        new Promise<string>((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            observedAborted = true
            reject(new Error('aborted'))
          })
          // Signal the test once the queryFn has actually started and the
          // abort listener is wired up. No real timers required.
          queryStarted.resolve()
        }),
    })
    // Swallow the rejection from fetchQuery
    inflight.catch(() => {})

    await queryStarted.promise

    triggerCleanup()
    // Flush microtasks so the abort event handler runs.
    await Promise.resolve()
    await Promise.resolve()

    expect(observedAborted).toBe(true)
  })

  it('cleanup is idempotent: listener runs exactly once even with repeated triggers', async () => {
    const queryClient = track(new QueryClient())
    const {
      router,
      triggerCleanup,
      attachServerSsr,
      setDehydrated,
      cleanupListenerCount,
    } = createServerRouter()

    router.serverSsr = undefined
    setupCoreRouterSsrQueryIntegration({
      router: router as any,
      queryClient,
    })
    attachServerSsr()
    setDehydrated(true)

    // Cleanup was registered at setup because serverSsr was already attached.
    await queryClient.fetchQuery({
      queryKey: ['x'],
      queryFn: () => 'data',
    })
    expect(cleanupListenerCount()).toBe(1)
    expect(queryClient.getQueryData(['x'])).toBe('data')

    triggerCleanup()
    // Cache cleared by teardown.
    expect(queryClient.getQueryData(['x'])).toBeUndefined()

    // Second trigger after listeners already drained: no throw, no
    // re-registration (cleanupRegistered flag prevents re-subscribe).
    expect(() => triggerCleanup()).not.toThrow()
    expect(cleanupListenerCount()).toBe(0)
  })

  it('registers cleanup when serverSsr attaches after subscriber setup', async () => {
    // Simulate user code prepopulating the cache inside getRouter() BEFORE
    // attachRouterServerSsrUtils() runs. queryCache subscriber fires while
    // serverSsr is undefined; cleanup still registers at attach time, before
    // router.load() can throw in beforeLoad.
    const queryClient = track(new QueryClient())
    const {
      router,
      triggerCleanup,
      attachServerSsr,
      setDehydrated,
      cleanupListenerCount,
    } = createServerRouter()
    // Detach to simulate pre-attach state.
    router.serverSsr = undefined

    setupCoreRouterSsrQueryIntegration({
      router: router as any,
      queryClient,
    })

    // Prepopulate before attach; queryCache event fires while serverSsr is
    // undefined. This must not be the registration point.
    await queryClient.fetchQuery({
      queryKey: ['pre'],
      queryFn: () => 'early',
    })
    expect(cleanupListenerCount()).toBe(0)

    // attachRouterServerSsrUtils equivalent. No onBeforeLoad/dehydrate needed.
    attachServerSsr()
    setDehydrated(true)
    expect(cleanupListenerCount()).toBe(1)

    triggerCleanup()
    expect(queryClient.getQueryData(['pre'])).toBeUndefined()
  })
})
