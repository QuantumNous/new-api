import {
  dehydrate as queryDehydrate,
  hydrate as queryHydrate,
} from '@tanstack/query-core'
import { isRedirect } from '@tanstack/router-core'
import { isServer } from '@tanstack/router-core/isServer'
import type { AnyRouter } from '@tanstack/router-core'
import type {
  DehydrateOptions,
  HydrateOptions,
  QueryClient,
  DehydratedState as QueryDehydratedState,
} from '@tanstack/query-core'

export type RouterSsrQueryOptions<TRouter extends AnyRouter> = {
  router: TRouter
  queryClient: QueryClient
  dehydrateOptions?: DehydrateOptions
  hydrateOptions?: HydrateOptions

  /**
   * If `true`, the QueryClient will handle errors thrown by `redirect()` inside of mutations and queries.
   *
   * @default true
   * @link [Guide](https://tanstack.com/router/latest/docs/framework/react/api/router/redirectFunction)
   */
  handleRedirects?: boolean
}

type DehydratedRouterQueryState = {
  dehydratedQueryClient?: QueryDehydratedState
  queryStream: ReadableStream<QueryDehydratedState>
}

export function setupCoreRouterSsrQueryIntegration<TRouter extends AnyRouter>({
  router,
  queryClient,
  dehydrateOptions,
  hydrateOptions,
  handleRedirects = true,
}: RouterSsrQueryOptions<TRouter>) {
  const ogHydrate = router.options.hydrate
  const ogDehydrate = router.options.dehydrate

  if (isServer ?? router.isServer) {
    const sentQueries = new Set<string>()
    const queryStream = createPushableStream()
    let unsubscribe: (() => void) | undefined = undefined
    let cleanupRegistered = false
    let tornDown = false

    const teardown = () => {
      if (tornDown) return
      tornDown = true
      try {
        unsubscribe?.()
      } catch {
        // ignore
      }
      unsubscribe = undefined
      try {
        if (!queryStream.isClosed()) queryStream.close()
      } catch {
        // ignore
      }
      // Cancel any in-flight queries and clear the cache. Removing queries
      // cancels their gcTime setTimeout handles which would otherwise pin
      // the queryClient (and transitively the router via router.context)
      // alive for the full gcTime window (default 5min) per SSR request.
      try {
        queryClient.cancelQueries()
      } catch {
        // ignore
      }
      try {
        queryClient.clear()
      } catch {
        // ignore
      }
      sentQueries.clear()
    }

    // Register teardown as soon as SSR attaches. attachRouterServerSsrUtils()
    // runs before router.load(), so this covers redirects/errors thrown before
    // router.options.dehydrate() can run.
    const registerCleanup = (serverSsr = router.serverSsr) => {
      if (cleanupRegistered) return
      if (!serverSsr) return
      serverSsr.onCleanup(teardown)
      cleanupRegistered = true
    }
    router.serverSsrLifecycle = {
      ...router.serverSsrLifecycle,
      onServerSsrAttach: [
        ...(router.serverSsrLifecycle?.onServerSsrAttach ?? []),
        registerCleanup,
      ],
    }

    router.options.dehydrate =
      async (): Promise<DehydratedRouterQueryState> => {
        router.serverSsr!.onRenderFinished(() => {
          if (!queryStream.isClosed()) queryStream.close()
          unsubscribe?.()
          unsubscribe = undefined
        })
        const ogDehydrated = await ogDehydrate?.()

        const dehydratedRouter = {
          ...ogDehydrated,
          // prepare the stream for queries coming up during rendering
          queryStream: queryStream.stream,
        }

        const dehydratedQueryClient = queryDehydrate(
          queryClient,
          dehydrateOptions,
        )
        if (dehydratedQueryClient.queries.length > 0) {
          dehydratedQueryClient.queries.forEach((query) => {
            sentQueries.add(query.queryHash)
          })
          dehydratedRouter.dehydratedQueryClient = dehydratedQueryClient
        }

        return dehydratedRouter
      }

    const ogClientOptions = queryClient.getDefaultOptions()
    queryClient.setDefaultOptions({
      ...ogClientOptions,
      dehydrate: {
        shouldDehydrateQuery: () => true,
        ...ogClientOptions.dehydrate,
      },
    })

    unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      // before rendering starts, we do not stream individual queries
      // instead we dehydrate the entire query client in router's dehydrate()
      // if attachRouterServerSsrUtils() has not been called yet, `router.serverSsr` will be undefined and we also do not stream
      if (!router.serverSsr?.isDehydrated()) {
        return
      }
      if (sentQueries.has(event.query.queryHash)) {
        return
      }
      // promise not yet set on the query, so we cannot stream it yet
      if (!event.query.promise) {
        return
      }
      if (queryStream.isClosed()) {
        console.warn(
          `tried to stream query ${event.query.queryHash} after stream was already closed`,
        )
        return
      }
      const dehydratedQuery = queryDehydrate(queryClient, {
        ...dehydrateOptions,
        shouldDehydrateQuery: (query) => {
          if (query.queryHash !== event.query.queryHash) {
            return false
          }

          return (
            (ogClientOptions.dehydrate?.shouldDehydrateQuery?.(query) ??
              true) &&
            (dehydrateOptions?.shouldDehydrateQuery?.(query) ?? true)
          )
        },
      })

      if (dehydratedQuery.queries.length === 0) {
        return
      }

      sentQueries.add(event.query.queryHash)
      queryStream.enqueue(dehydratedQuery)
    })
    // on the client
  } else {
    router.options.hydrate = async (dehydrated: DehydratedRouterQueryState) => {
      await ogHydrate?.(dehydrated)
      // hydrate the query client with the dehydrated data (if it was dehydrated on the server)
      if (dehydrated.dehydratedQueryClient) {
        queryHydrate(
          queryClient,
          dehydrated.dehydratedQueryClient,
          hydrateOptions,
        )
      }

      // read the query stream and hydrate the queries as they come in
      const reader = dehydrated.queryStream.getReader()
      reader
        .read()
        .then(async function handle({ done, value }) {
          queryHydrate(queryClient, value, hydrateOptions)
          if (done) {
            return
          }
          const result = await reader.read()
          return handle(result)
        })
        .catch((err) => {
          console.error('Error reading query stream:', err)
        })
    }
    if (handleRedirects) {
      const ogMutationCacheConfig = queryClient.getMutationCache().config
      queryClient.getMutationCache().config = {
        ...ogMutationCacheConfig,
        onError: (error, ...rest) => {
          if (isRedirect(error)) {
            error.options._fromLocation = router.stores.location.get()
            return router.navigate(router.resolveRedirect(error).options)
          }

          return ogMutationCacheConfig.onError?.(error, ...rest)
        },
      }

      const ogQueryCacheConfig = queryClient.getQueryCache().config
      queryClient.getQueryCache().config = {
        ...ogQueryCacheConfig,
        onError: (error, ...rest) => {
          if (isRedirect(error)) {
            error.options._fromLocation = router.stores.location.get()
            return router.navigate(router.resolveRedirect(error).options)
          }

          return ogQueryCacheConfig.onError?.(error, ...rest)
        },
      }
    }
  }
}

type PushableStream = {
  stream: ReadableStream
  enqueue: (chunk: unknown) => void
  close: () => void
  isClosed: () => boolean
  error: (err: unknown) => void
}

function createPushableStream(): PushableStream {
  let controllerRef: ReadableStreamDefaultController
  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller
    },
  })
  let _isClosed = false

  return {
    stream,
    enqueue: (chunk) => {
      if (!_isClosed) controllerRef.enqueue(chunk)
    },
    close: () => {
      if (_isClosed) return
      controllerRef.close()
      _isClosed = true
    },
    isClosed: () => _isClosed,
    error: (err: unknown) => {
      if (_isClosed) return
      _isClosed = true
      controllerRef.error(err)
    },
  }
}
