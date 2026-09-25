import {
  Asset,
  Await,
  Block,
  CatchBoundary,
  CatchNotFound,
  ClientOnly,
  DefaultGlobalNotFound,
  ErrorComponent,
  HeadContent,
  Link,
  Match,
  MatchRoute,
  Matches,
  Navigate,
  Outlet,
  RouterContextProvider,
  ScriptOnce,
  Scripts,
  ScrollRestoration,
  createLink,
  createRootRoute,
  linkOptions,
  useAwaited,
  useBlocker,
  useCanGoBack,
  useChildMatches,
  useElementScrollRestoration,
  useHydrated,
  useLinkProps,
  useLoaderData,
  useLoaderDeps,
  useLocation,
  useMatch,
  useMatchRoute,
  useMatches,
  useNavigate,
  useParams,
  useParentMatches,
  useRouteContext,
  useRouter,
  useRouterState,
  useSearch,
  useTags,
} from '@tanstack/solid-router'
import {
  createMiddleware,
  createServerFn,
  useServerFn,
} from '@tanstack/solid-start'

type BundleSizeKeep = {
  hooksAndComponents: ReadonlyArray<unknown>
  startSurface: ReadonlyArray<unknown>
}

declare global {
  var __TANSTACK_BUNDLE_SIZE_KEEP__: BundleSizeKeep | undefined
}

const requestMiddleware = createMiddleware().server(async ({ next }) => {
  return next()
})

const functionMiddleware = createMiddleware({ type: 'function' })
  .client(async ({ next }) => {
    return next()
  })
  .server(async ({ next }) => {
    return next()
  })

const helloServerFn = createServerFn({ method: 'GET' })
  .middleware([requestMiddleware, functionMiddleware])
  .handler(async () => {
    return 'hello from server fn'
  })

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  const router = useRouter()
  const hydrated = useHydrated()
  const [awaited] = useAwaited({ promise: Promise.resolve('ready') })
  const linkProps = useLinkProps({ to: '/' })
  const matchRoute = useMatchRoute()
  const matches = useMatches()
  const parentMatches = useParentMatches()
  const childMatches = useChildMatches()
  const match = useMatch({ strict: false, shouldThrow: false })
  const loaderDeps = useLoaderDeps({ strict: false })
  const loaderData = useLoaderData({ strict: false })
  const params = useParams({ strict: false })
  const search = useSearch({ strict: false })
  const routeContext = useRouteContext({ strict: false })
  const routerState = useRouterState({ select: (state) => state.status })
  const location = useLocation()
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()
  const scrollEntry = useElementScrollRestoration({ id: 'root-scroll' })
  const tags = useTags()
  const invokeServerFn = useServerFn(helloServerFn)

  useBlocker({
    shouldBlockFn: () => false,
    disabled: true,
    withResolver: false,
  })

  const linkFactoryResult = linkOptions({ to: '/' })
  const routeMatchResult = matchRoute({ to: '/' })
  const SvgLink = createLink('svg')

  const startSurface = [createMiddleware, createServerFn, useServerFn]
  const hooksAndComponents = [
    useAwaited,
    useHydrated,
    useLinkProps,
    useMatchRoute,
    useMatches,
    useParentMatches,
    useChildMatches,
    useMatch,
    useLoaderDeps,
    useLoaderData,
    useBlocker,
    useNavigate,
    useParams,
    useSearch,
    useRouteContext,
    useRouter,
    useRouterState,
    useLocation,
    useCanGoBack,
    useElementScrollRestoration,
    useTags,
    Await,
    CatchBoundary,
    CatchNotFound,
    ClientOnly,
    DefaultGlobalNotFound,
    ErrorComponent,
    Link,
    Match,
    MatchRoute,
    Matches,
    Navigate,
    Outlet,
    RouterContextProvider,
    ScrollRestoration,
    Block,
    ScriptOnce,
    Asset,
    HeadContent,
    Scripts,
  ]

  globalThis.__TANSTACK_BUNDLE_SIZE_KEEP__ = {
    hooksAndComponents,
    startSurface,
  }

  void awaited
  void linkFactoryResult
  void matches()
  void parentMatches()
  void childMatches()
  void match()
  void loaderDeps()
  void loaderData()
  void params()
  void search()
  void routeContext()
  void routerState()
  void location()
  void canGoBack()
  void navigate
  void scrollEntry
  void tags()
  void routeMatchResult()
  void invokeServerFn

  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <ScriptOnce>{'window.__tsr_bundle_size = true'}</ScriptOnce>
        <Asset
          tag="meta"
          attrs={{ name: 'bundle-size', content: 'solid-start-full' }}
        />
        <Link {...linkProps}>home</Link>
        <SvgLink to="/" aria-label="svg-home">
          <circle cx="8" cy="8" r="7" />
        </SvgLink>
        <MatchRoute to="/">{() => <span data-test="match-route" />}</MatchRoute>
        <ClientOnly fallback={<span data-test="client-only-fallback" />}>
          <span data-test="client-only" />
        </ClientOnly>
        <Await promise={Promise.resolve('done')}>
          {() => <span data-test="await" />}
        </Await>
        <Block shouldBlockFn={() => false} disabled withResolver={false}>
          {() => <span data-test="block" />}
        </Block>
        <CatchNotFound fallback={() => <DefaultGlobalNotFound />}>
          <span data-test="catch-not-found" />
        </CatchNotFound>
        <RouterContextProvider router={router}>
          {() => <span data-test="nested-router-context" />}
        </RouterContextProvider>
        <ScrollRestoration />
        <Outlet />
        <Scripts />
        <div data-test="full-root" data-hydrated={String(hydrated())}>
          <div>hello world</div>
        </div>
      </body>
    </html>
  )
}
