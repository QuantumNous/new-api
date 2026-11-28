import { crossSerializeStream, getCrossReferenceHeader } from 'seroval'
import { invariant } from '../invariant'
import {
  createInlineCssPlaceholderAsset,
  createInlineCssStyleAsset,
  getStylesheetHref,
} from '../manifest'
import { decodePath } from '../utils'
import { createLRUCache } from '../lru-cache'
import { rootRouteId } from '../root'
import minifiedTsrBootStrapScript from './tsrScript?script-string'
import { GLOBAL_TSR, TSR_SCRIPT_BARRIER_ID } from './constants'
import { dehydrateSsrMatchId } from './ssr-match-id'
import { defaultSerovalPlugins } from './serializer/seroval-plugins'
import { makeSsrSerovalPlugin } from './serializer/transformer'
import type { LRUCache } from '../lru-cache'
import type { DehydratedMatch, DehydratedRouter } from './types'
import type { AnySerializationAdapter } from './serializer/transformer'
import type { AnyRouter, ServerSsr } from '../router'
import type { AnyRouteMatch } from '../Matches'
import type {
  Manifest,
  ManifestRoute,
  ManifestRouteAssets,
  RouterManagedTag,
  ServerManifest,
} from '../manifest'

const SCOPE_ID = 'tsr'

const TSR_PREFIX = GLOBAL_TSR + '.router='
const P_PREFIX = GLOBAL_TSR + '.p(()=>'
const P_SUFFIX = ')'

export function dehydrateMatch(match: AnyRouteMatch): DehydratedMatch {
  const dehydratedMatch: DehydratedMatch = {
    i: dehydrateSsrMatchId(match.id),
    u: match.updatedAt,
    s: match.status,
  }

  const properties = [
    ['__beforeLoadContext', 'b'],
    ['loaderData', 'l'],
    ['error', 'e'],
    ['ssr', 'ssr'],
  ] as const

  for (const [key, shorthand] of properties) {
    if (match[key] !== undefined) {
      dehydratedMatch[shorthand] = match[key]
    }
  }
  if (match.globalNotFound) {
    dehydratedMatch.g = true
  }
  return dehydratedMatch
}

const INITIAL_SCRIPTS = [
  getCrossReferenceHeader(SCOPE_ID),
  minifiedTsrBootStrapScript,
]

class ScriptBuffer {
  private injectScript: ((script: string) => void) | undefined
  private _queue: Array<string>
  private _scriptBarrierLifted = false
  private _cleanedUp = false
  private _microtaskVersion = 0
  private _pendingMicrotaskVersion = 0

  constructor(injectScript: (script: string) => void) {
    this.injectScript = injectScript
    // Copy INITIAL_SCRIPTS to avoid mutating the shared array
    this._queue = INITIAL_SCRIPTS.slice()
  }

  enqueue(script: string) {
    if (this._cleanedUp) return
    this._queue.push(script)
    if (this._scriptBarrierLifted) {
      this.scheduleInjectBufferedScripts()
    }
  }

  liftBarrier() {
    if (this._scriptBarrierLifted || this._cleanedUp) return
    this._scriptBarrierLifted = true
    if (this._queue.length > 0) {
      this.scheduleInjectBufferedScripts()
    }
  }

  scheduleInjectBufferedScripts() {
    if (this._pendingMicrotaskVersion !== 0) return
    const pendingVersion = ++this._microtaskVersion
    this._pendingMicrotaskVersion = pendingVersion
    queueMicrotask(() => {
      if (this._pendingMicrotaskVersion !== pendingVersion) return
      this._pendingMicrotaskVersion = 0
      this.injectBufferedScripts()
    })
  }

  clearPendingMicrotask() {
    if (this._pendingMicrotaskVersion === 0) return
    this._pendingMicrotaskVersion = 0
    this._microtaskVersion++
  }

  /**
   * Flushes any pending scripts synchronously.
   * Call this before signaling serialization finished to ensure all scripts are injected.
   *
   * IMPORTANT: Only injects if the barrier has been lifted. Before the barrier is lifted,
   * scripts should remain in the queue so takeBufferedScripts() can retrieve them
   */
  flush() {
    if (!this._scriptBarrierLifted) return
    if (this._cleanedUp) return
    this.clearPendingMicrotask()
    this.injectBufferedScripts()
  }

  takeAll() {
    return this.takeScripts(this._queue.length)
  }

  takeScripts(count: number) {
    if (count <= 0) return undefined
    const bufferedScripts = this._queue.splice(0, count)
    if (bufferedScripts.length === 0) {
      return undefined
    }
    // Optimization: if only one script, avoid join
    if (bufferedScripts.length === 1) {
      return bufferedScripts[0] + ';document.currentScript.remove()'
    }
    // Append cleanup script and join - avoid push() to not mutate then iterate
    return bufferedScripts.join(';') + ';document.currentScript.remove()'
  }

  hasPending() {
    return this._queue.length > 0
  }

  injectBufferedScripts() {
    if (this._cleanedUp) return
    // Early return if queue is empty (avoids unnecessary takeAll() call)
    if (this._queue.length === 0) return
    const scriptsToInject = this.takeAll()
    if (scriptsToInject) {
      this.injectScript?.(scriptsToInject)
    }
  }

  cleanup() {
    this._cleanedUp = true
    this.clearPendingMicrotask()
    this._queue = []
    this.injectScript = undefined
  }
}

const isProd = process.env.NODE_ENV === 'production'

type FilteredRoutes = Manifest['routes']

type PreparedMatchedManifestRoutes = {
  routes: FilteredRoutes
  hasStrippedRoutes: boolean
  inlineCssHrefs?: Array<string>
  inlineCss?: string
}

type ManifestLRU = LRUCache<string, PreparedMatchedManifestRoutes>

const MANIFEST_CACHE_SIZE = 100
const manifestCaches = new WeakMap<ServerManifest, ManifestLRU>()

function getManifestCache(manifest: ServerManifest): ManifestLRU {
  const cache = manifestCaches.get(manifest)
  if (cache) return cache
  const newCache = createLRUCache<string, PreparedMatchedManifestRoutes>(
    MANIFEST_CACHE_SIZE,
  )
  manifestCaches.set(manifest, newCache)
  return newCache
}

function getInlineCssForPreparedRoutes(
  manifest: ServerManifest,
  preparedRoutes: PreparedMatchedManifestRoutes,
) {
  if (preparedRoutes.inlineCss !== undefined) return preparedRoutes.inlineCss

  const styles = manifest.inlineCss?.styles
  const hrefs = preparedRoutes.inlineCssHrefs
  if (!styles || !hrefs?.length) return undefined

  let css = ''
  for (const href of hrefs) {
    css += styles[href]!
  }

  preparedRoutes.inlineCss = css
  return css
}

function getInlineCssAssetForPreparedRoutes(
  manifest: ServerManifest,
  preparedRoutes: PreparedMatchedManifestRoutes,
) {
  const css = getInlineCssForPreparedRoutes(manifest, preparedRoutes)

  return css === undefined ? undefined : createInlineCssStyleAsset(css)
}

function getMatchedRoutesCacheKey(matches: Array<AnyRouteMatch>) {
  let cacheKey = ''
  for (let i = 0; i < matches.length; i++) {
    cacheKey += (i === 0 ? '' : '\0') + matches[i]!.routeId
  }
  return cacheKey
}

function getPreparedMatchedManifestRoutes(
  manifest: ServerManifest,
  matches: Array<AnyRouteMatch>,
  cacheKey: string,
) {
  if (isProd) {
    const cached = getManifestCache(manifest).get(cacheKey)
    if (cached) {
      return cached
    }
  }

  const preparedRoutes = prepareMatchedManifestRoutes(manifest, matches)

  if (isProd) {
    getManifestCache(manifest).set(cacheKey, preparedRoutes)
  }

  return preparedRoutes
}

function prepareMatchedManifestRoutes(
  manifest: ServerManifest,
  matches: Array<AnyRouteMatch>,
): PreparedMatchedManifestRoutes {
  const inlineStyles = manifest.inlineCss?.styles
  const routes: FilteredRoutes = {}

  if (!inlineStyles) {
    for (const match of matches) {
      const route = manifest.routes[match.routeId]
      if (route) {
        routes[match.routeId] = route
      }
    }
    return { routes, hasStrippedRoutes: false }
  }

  const inlineCssHrefs: Array<string> = []
  const seenInlineCssHrefs = new Set<string>()
  let hasStrippedRoutes = false

  for (const match of matches) {
    const routeId = match.routeId
    const route = manifest.routes[routeId]
    if (!route) {
      continue
    }

    const nextRoute = stripInlinedStylesheetAssetsFromRoute(
      inlineStyles,
      route,
      inlineCssHrefs,
      seenInlineCssHrefs,
    )

    if (nextRoute !== route) {
      hasStrippedRoutes = true
    }
    routes[routeId] = nextRoute
  }

  return {
    routes,
    hasStrippedRoutes,
    ...(inlineCssHrefs.length ? { inlineCssHrefs } : {}),
  }
}

function stripInlinedStylesheetAssetsFromRoute(
  inlineStyles: Record<string, string>,
  route: ManifestRoute,
  inlineCssHrefs: Array<string>,
  seenInlineCssHrefs: Set<string>,
): ManifestRoute {
  const css = route.css
  if (!css) {
    return route
  }

  if (css.length === 0) {
    const nextRoute = { ...route }
    delete nextRoute.css
    return nextRoute
  }

  let cssLinks: typeof css | undefined
  for (let i = 0; i < css.length; i++) {
    const link = css[i]!
    const href = getStylesheetHref(link)
    if (inlineStyles[href] === undefined) {
      if (cssLinks) {
        cssLinks.push(link)
      }
      continue
    }

    if (!seenInlineCssHrefs.has(href)) {
      seenInlineCssHrefs.add(href)
      inlineCssHrefs.push(href)
    }

    if (!cssLinks) {
      cssLinks = css.slice(0, i)
    }
  }

  if (!cssLinks) {
    return route
  }

  if (cssLinks.length > 0) {
    return { ...route, css: cssLinks }
  }

  const nextRoute = { ...route }
  delete nextRoute.css
  return nextRoute
}

function hasRouteAssets(route: ManifestRoute) {
  return !!route.scripts?.length || !!route.css?.length
}

function hasRequestAssets(assets: ManifestRouteAssets | undefined) {
  return !!assets && (!!assets.preloads?.length || hasRouteAssets(assets))
}

function mergeRequestAssetsIntoRootRoute(
  rootRoute: ManifestRoute | undefined,
  requestAssets: ManifestRouteAssets | undefined,
): ManifestRoute {
  const preloads = requestAssets?.preloads?.length
    ? [...requestAssets.preloads, ...(rootRoute?.preloads ?? [])]
    : rootRoute?.preloads
  const scripts = requestAssets?.scripts?.length
    ? [...requestAssets.scripts, ...(rootRoute?.scripts ?? [])]
    : rootRoute?.scripts
  const cssLinks = requestAssets?.css?.length
    ? [...requestAssets.css, ...(rootRoute?.css ?? [])]
    : rootRoute?.css

  return {
    ...(rootRoute ?? {}),
    ...(preloads?.length ? { preloads } : {}),
    ...(scripts?.length ? { scripts } : {}),
    ...(cssLinks?.length ? { css: cssLinks } : {}),
  }
}

export function attachRouterServerSsrUtils({
  router,
  manifest,
  getRequestAssets,
}: {
  router: AnyRouter
  manifest: ServerManifest | undefined
  getRequestAssets?: () => ManifestRouteAssets | undefined
}) {
  router.ssr = {
    get manifest() {
      if (!manifest) return manifest

      const requestAssets = getRequestAssets?.()
      const matches = router.stores.matches.get()
      const hasAssets = hasRequestAssets(requestAssets)

      if (!hasAssets && !manifest.inlineCss) {
        return manifest
      }

      let inlineCssAsset: Manifest['inlineStyle'] | undefined
      let routes = manifest.routes
      if (manifest.inlineCss) {
        const cacheKey = getMatchedRoutesCacheKey(matches)
        const preparedManifest = getPreparedMatchedManifestRoutes(
          manifest,
          matches,
          cacheKey,
        )
        inlineCssAsset = getInlineCssAssetForPreparedRoutes(
          manifest,
          preparedManifest,
        )
        if (preparedManifest.hasStrippedRoutes) {
          routes = { ...manifest.routes, ...preparedManifest.routes }
        }
      }

      if (!hasAssets) {
        return {
          ...(manifest.scriptFormat
            ? { scriptFormat: manifest.scriptFormat }
            : {}),
          ...(inlineCssAsset ? { inlineStyle: inlineCssAsset } : {}),
          routes,
        }
      }

      const rootRoute = routes[rootRouteId]

      // Merge request-scoped assets into root route without mutating cached manifest
      return {
        ...(manifest.scriptFormat
          ? { scriptFormat: manifest.scriptFormat }
          : {}),
        ...(inlineCssAsset ? { inlineStyle: inlineCssAsset } : {}),
        routes: {
          ...routes,
          [rootRouteId]: mergeRequestAssetsIntoRootRoute(
            rootRoute,
            requestAssets,
          ),
        },
      }
    },
  }
  let _dehydrated = false
  let _serializationFinished = false
  let streamFastPathReserved = false
  const renderFinishedListeners: Array<() => void> = []
  const injectedHtmlListeners: Array<() => void> = []
  const serializationFinishedListeners: Array<() => void> = []
  const cleanupListeners: Array<() => void> = []
  let cleanupStarted = false
  let injectedHtmlBuffer = ''

  const callListeners = (listeners: Array<() => void>, errorPrefix: string) => {
    const snapshot = listeners.slice()
    for (const l of snapshot) {
      try {
        l()
      } catch (err) {
        console.error(`${errorPrefix}:`, err)
      }
    }
  }

  const removeListener = (
    listeners: Array<() => void>,
    listener: () => void,
  ) => {
    const index = listeners.indexOf(listener)
    if (index >= 0) listeners.splice(index, 1)
  }

  const scriptBuffer = new ScriptBuffer((script) => {
    serverSsr.injectScript(script)
  })

  const serverSsr: ServerSsr = {
    injectHtml: (html: string) => {
      if (!html || cleanupStarted) return
      // Buffer the HTML so it can be retrieved via takeBufferedHtml()
      injectedHtmlBuffer += html
      callListeners(injectedHtmlListeners, 'SSR injected HTML listener error')
    },
    injectScript: (script: string) => {
      if (!script || cleanupStarted) return
      const html = `<script${router.options.ssr?.nonce ? ` nonce='${router.options.ssr.nonce}'` : ''}>${script}</script>`
      serverSsr.injectHtml(html)
    },
    dehydrate: async (opts?: { requestAssets?: ManifestRouteAssets }) => {
      if (_dehydrated) {
        if (process.env.NODE_ENV !== 'production') {
          throw new Error('Invariant failed: router is already dehydrated!')
        }

        invariant()
      }
      let matchesToDehydrate = router.stores.matches.get()
      if (router.isShell()) {
        // In SPA mode we only want to dehydrate the root match
        matchesToDehydrate = matchesToDehydrate.slice(0, 1)
      }
      const matches = matchesToDehydrate.map(dehydrateMatch)

      let manifestToDehydrate: Manifest | undefined = undefined
      // Only currently matched routes are dehydrated. Other route assets are
      // loaded through dynamic imports when those routes become active.
      if (manifest) {
        const cacheKey = getMatchedRoutesCacheKey(matchesToDehydrate)
        const preparedManifest = getPreparedMatchedManifestRoutes(
          manifest,
          matchesToDehydrate,
          cacheKey,
        )

        manifestToDehydrate = {
          ...(manifest.scriptFormat
            ? { scriptFormat: manifest.scriptFormat }
            : {}),
          ...(preparedManifest.inlineCssHrefs
            ? { inlineStyle: createInlineCssPlaceholderAsset() }
            : {}),
          routes: preparedManifest.routes,
        }

        // Merge request-scoped assets into root route (without mutating cached manifest)
        const requestAssets = opts?.requestAssets
        if (hasRequestAssets(requestAssets)) {
          const existingRoot = manifestToDehydrate.routes[rootRouteId]
          manifestToDehydrate.routes = {
            ...manifestToDehydrate.routes,
            [rootRouteId]: mergeRequestAssetsIntoRootRoute(
              existingRoot,
              requestAssets,
            ),
          }
        }
      }
      const dehydratedRouter: DehydratedRouter = {
        manifest: manifestToDehydrate,
        matches,
      }
      const lastMatchId = matchesToDehydrate[matchesToDehydrate.length - 1]?.id
      if (lastMatchId) {
        dehydratedRouter.lastMatchId = dehydrateSsrMatchId(lastMatchId)
      }
      const dehydratedData = await router.options.dehydrate?.()
      if (dehydratedData) {
        dehydratedRouter.dehydratedData = dehydratedData
      }
      _dehydrated = true

      const trackPlugins = { didRun: false }
      const serializationAdapters = router.options.serializationAdapters as
        | Array<AnySerializationAdapter>
        | undefined
      const plugins = serializationAdapters
        ? serializationAdapters
            .map((t) => makeSsrSerovalPlugin(t, trackPlugins))
            .concat(defaultSerovalPlugins)
        : defaultSerovalPlugins

      let serializationCompleteSignaled = false
      const signalSerializationComplete = () => {
        if (serializationCompleteSignaled || cleanupStarted) return
        serializationCompleteSignaled = true
        _serializationFinished = true

        const listeners = serializationFinishedListeners.slice()
        serializationFinishedListeners.length = 0

        for (const l of listeners) {
          try {
            l()
          } catch (err) {
            console.error('Serialization listener error:', err)
          }
        }
      }

      const finishScriptSerialization = () => {
        if (serializationCompleteSignaled || cleanupStarted) return
        scriptBuffer.enqueue(GLOBAL_TSR + '.e()')
        // Must synchronously notify injected HTML listeners before signaling
        // completion; otherwise the held </body> tail could flush ahead of the
        // end script.
        scriptBuffer.flush()
        signalSerializationComplete()
      }

      crossSerializeStream(dehydratedRouter, {
        refs: new Map(),
        plugins,
        onSerialize: (data, initial) => {
          let serialized = initial ? TSR_PREFIX + data : data
          if (trackPlugins.didRun) {
            serialized = P_PREFIX + serialized + P_SUFFIX
          }
          scriptBuffer.enqueue(serialized)
        },
        onError: (err: unknown) => {
          console.error('Serialization error:', err)
          if (err && (err as any).stack) {
            console.error((err as any).stack)
          }
          finishScriptSerialization()
        },
        scopeId: SCOPE_ID,
        onDone: () => {
          finishScriptSerialization()
        },
      })
    },
    isDehydrated() {
      return _dehydrated
    },
    isSerializationFinished() {
      return _serializationFinished
    },
    reserveStreamFastPath() {
      if (
        !cleanupStarted &&
        _serializationFinished &&
        !streamFastPathReserved &&
        renderFinishedListeners.length === 0 &&
        !injectedHtmlBuffer &&
        !scriptBuffer.hasPending()
      ) {
        streamFastPathReserved = true
        return true
      }
      return false
    },
    onInjectedHtml: (listener) => {
      if (cleanupStarted) return () => {}
      injectedHtmlListeners.push(listener)
      return () => removeListener(injectedHtmlListeners, listener)
    },
    onRenderFinished: (listener) => {
      if (cleanupStarted || streamFastPathReserved) return
      renderFinishedListeners.push(listener)
    },
    onSerializationFinished: (listener) => {
      if (cleanupStarted) return () => {}
      if (_serializationFinished && !cleanupStarted) {
        try {
          listener()
        } catch (err) {
          console.error('Serialization listener error:', err)
        }
        return () => {}
      }
      serializationFinishedListeners.push(listener)
      return () => removeListener(serializationFinishedListeners, listener)
    },
    onCleanup: (listener) => {
      if (cleanupStarted) return
      cleanupListeners.push(listener)
    },
    setRenderFinished: () => {
      if (cleanupStarted) return
      scriptBuffer.liftBarrier()
      const listeners = renderFinishedListeners.slice()
      renderFinishedListeners.length = 0
      for (const l of listeners) {
        try {
          l()
        } catch (err) {
          console.error('Error in render finished listener:', err)
        }
      }
      if (_serializationFinished) {
        scriptBuffer.flush()
      }
    },
    takeBufferedScripts() {
      const scripts = scriptBuffer.takeAll()
      if (!scripts) return undefined
      const serverBufferedScript: RouterManagedTag = {
        tag: 'script',
        attrs: {
          nonce: router.options.ssr?.nonce,
          className: '$tsr',
          id: TSR_SCRIPT_BARRIER_ID,
        },
        children: scripts,
      }
      return serverBufferedScript
    },
    liftScriptBarrier() {
      scriptBuffer.liftBarrier()
    },
    takeBufferedHtml() {
      if (!injectedHtmlBuffer) {
        return undefined
      }
      const buffered = injectedHtmlBuffer
      injectedHtmlBuffer = ''
      return buffered
    },
    cleanup() {
      // Guard against multiple/reentrant cleanup calls. A listener could call
      // cleanup() again indirectly; snapshot + clear before invoking so each
      // listener runs exactly once and reentry is a no-op.
      if (cleanupStarted) return
      cleanupStarted = true
      const listeners = cleanupListeners.slice()
      cleanupListeners.length = 0
      for (const l of listeners) {
        try {
          l()
        } catch (err) {
          console.error('Error in SSR cleanup listener:', err)
        }
      }
      renderFinishedListeners.length = 0
      injectedHtmlListeners.length = 0
      serializationFinishedListeners.length = 0
      injectedHtmlBuffer = ''
      scriptBuffer.cleanup()
      router.serverSsr = undefined
    },
  }

  router.serverSsr = serverSsr
  for (const listener of router.serverSsrLifecycle?.onServerSsrAttach ?? []) {
    try {
      listener(serverSsr)
    } catch (err) {
      console.error('SSR attach listener error:', err)
    }
  }
}

/**
 * Get the origin for the request.
 *
 * SECURITY: We intentionally do NOT trust the Origin header for determining
 * the router's origin. The Origin header can be spoofed by attackers, which
 * could lead to SSRF-like vulnerabilities where redirects are constructed
 * using a malicious origin (CVE-2024-34351).
 *
 * Instead, we derive the origin from request.url, which is typically set by
 * the server infrastructure (not client-controlled headers).
 *
 * For applications behind proxies that need to trust forwarded headers,
 * use the router's `origin` option to explicitly configure a trusted origin.
 */
export function getOrigin(request: Request) {
  try {
    return new URL(request.url).origin
  } catch {}
  return 'http://localhost'
}

// server and browser can decode/encode characters differently in paths and search params.
// Server generally strictly follows the WHATWG URL Standard, while browsers may differ for legacy reasons.
// for example, in paths "|" is not encoded on the server but is encoded on chromium (and not on firefox) while "대" is encoded on both sides.
// Another anomaly is that in Node new URLSearchParams and new URL also decode/encode characters differently.
// new URLSearchParams() encodes "|" while new URL() does not, and in this instance
// chromium treats search params differently than paths, i.e. "|" is not encoded in search params.
export function getNormalizedURL(url: string | URL, base?: string | URL) {
  // ensure backslashes are encoded correctly in the URL
  if (typeof url === 'string') url = url.replace('\\', '%5C')

  const rawUrl = new URL(url, base)
  const { path: decodedPathname, handledProtocolRelativeURL } = decodePath(
    rawUrl.pathname,
  )
  const searchParams = new URLSearchParams(rawUrl.search)
  const normalizedHref =
    decodedPathname +
    (searchParams.size > 0 ? '?' : '') +
    searchParams.toString() +
    rawUrl.hash

  return {
    url: new URL(normalizedHref, rawUrl.origin),
    handledProtocolRelativeURL,
  }
}
