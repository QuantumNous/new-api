import {
  getScriptPreloadAttrs,
  getStylesheetHref,
  resolveManifestCssLink,
} from '@tanstack/router-core'
import type {
  AnyRoute,
  AnyRouteMatch,
  AssetCrossOrigin,
  RouterManagedTag,
  ServerManifest,
} from '@tanstack/router-core'

export type EarlyHint = {
  href: string
  rel: 'preload' | 'modulepreload' | 'preconnect' | 'dns-prefetch'
  as?: 'fetch' | 'font' | 'image' | 'script' | 'style' | 'track'
  crossOrigin?: AssetCrossOrigin | ''
  type?: string
  integrity?: string
  referrerPolicy?: string
  fetchPriority?: string
}

export type EarlyHintsPhase = 'static' | 'dynamic'

export type EarlyHintsEvent = {
  phase: EarlyHintsPhase
  hints: ReadonlyArray<EarlyHint>
  links: Array<string>
  allHints: ReadonlyArray<EarlyHint>
  allLinks: Array<string>
}

export type OnEarlyHints = (event: EarlyHintsEvent) => void | Promise<void>

export type ResponseLinkHeaderEntry = {
  phase: EarlyHintsPhase
  hint: EarlyHint
  link: string
}

export type ResponseLinkHeaderFilter = (
  entry: ResponseLinkHeaderEntry,
) => boolean

export type ResponseLinkHeaderOptions = {
  filter?: ResponseLinkHeaderFilter
}

export interface EarlyHintsCollector {
  collectStatic: (opts: {
    manifest: ServerManifest
    matchedRoutes?: ReadonlyArray<AnyRoute>
  }) => void
  collectDynamic: (matches: ReadonlyArray<AnyRouteMatch>) => void
  appendResponseHeaders: (headers: Headers) => void
}

const LINK_PARAM_TOKEN_RE = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/
const PRELOAD_AS_VALUES = new Set<EarlyHint['as']>([
  'fetch',
  'font',
  'image',
  'script',
  'style',
  'track',
])

function buildLinkParam(name: string, value: string | undefined): string {
  if (value === undefined) return name
  if (LINK_PARAM_TOKEN_RE.test(value)) return `${name}=${value}`
  return `${name}=${JSON.stringify(value)}`
}

export function serializeEarlyHint(hint: EarlyHint): string {
  const parts = [`<${hint.href}>`, buildLinkParam('rel', hint.rel)]
  if (hint.as) parts.push(buildLinkParam('as', hint.as))
  if (hint.crossOrigin !== undefined) {
    parts.push(buildLinkParam('crossorigin', hint.crossOrigin || undefined))
  }
  if (hint.type) parts.push(buildLinkParam('type', hint.type))
  if (hint.integrity) parts.push(buildLinkParam('integrity', hint.integrity))
  if (hint.referrerPolicy) {
    parts.push(buildLinkParam('referrerpolicy', hint.referrerPolicy))
  }
  if (hint.fetchPriority) {
    parts.push(buildLinkParam('fetchpriority', hint.fetchPriority))
  }
  return parts.join('; ')
}

function getStringAttr(
  attrs: Record<string, any> | undefined,
  name: string,
  fallbackName?: string,
): string | undefined {
  const value =
    attrs?.[name] ?? (fallbackName ? attrs?.[fallbackName] : undefined)
  return typeof value === 'string' ? value : undefined
}

function getPreloadAs(
  attrs: Record<string, any> | undefined,
): EarlyHint['as'] | undefined {
  const as = getStringAttr(attrs, 'as')
  return as && PRELOAD_AS_VALUES.has(as as EarlyHint['as'])
    ? (as as EarlyHint['as'])
    : undefined
}

function addEarlyHintFetchAttrs(
  hint: EarlyHint,
  attrs: Record<string, any> | undefined,
) {
  const crossOrigin = getStringAttr(attrs, 'crossOrigin', 'crossorigin') as
    | EarlyHint['crossOrigin']
    | undefined
  const type = getStringAttr(attrs, 'type')
  const integrity = getStringAttr(attrs, 'integrity')
  const referrerPolicy = getStringAttr(
    attrs,
    'referrerPolicy',
    'referrerpolicy',
  )
  const fetchPriority = getStringAttr(attrs, 'fetchPriority', 'fetchpriority')

  if (crossOrigin !== undefined) hint.crossOrigin = crossOrigin
  if (type) hint.type = type
  if (integrity) hint.integrity = integrity
  if (referrerPolicy) hint.referrerPolicy = referrerPolicy
  if (fetchPriority) hint.fetchPriority = fetchPriority
}

function linkAttrsToEarlyHint(
  attrs: Record<string, any> | undefined,
): EarlyHint | undefined {
  const href = getStringAttr(attrs, 'href')
  const rel = getStringAttr(attrs, 'rel')
  if (!href || !rel) return undefined

  const relTokens = rel.split(/\s+/)
  let hintRel: EarlyHint['rel'] | undefined
  let hintAs: EarlyHint['as'] | undefined

  if (relTokens.includes('modulepreload')) {
    hintRel = 'modulepreload'
    hintAs = 'script'
  } else if (relTokens.includes('stylesheet')) {
    hintRel = 'preload'
    hintAs = 'style'
  } else if (relTokens.includes('preload')) {
    hintAs = getPreloadAs(attrs)
    if (!hintAs) return undefined
    hintRel = 'preload'
  } else if (relTokens.includes('preconnect')) {
    hintRel = 'preconnect'
    hintAs = undefined
  } else if (relTokens.includes('dns-prefetch')) {
    hintRel = 'dns-prefetch'
    hintAs = undefined
  }

  if (!hintRel) return undefined

  const hint: EarlyHint = {
    href,
    rel: hintRel,
  }

  if (hintAs) hint.as = hintAs
  addEarlyHintFetchAttrs(hint, attrs)

  return hint
}

export function collectStaticHintsFromManifest(
  manifest: ServerManifest,
  matchedRoutes: ReadonlyArray<AnyRoute>,
): Array<EarlyHint> {
  const hints: Array<EarlyHint> = []

  for (const route of matchedRoutes) {
    const routeManifest = manifest.routes[route.id]
    if (!routeManifest) continue

    for (const link of routeManifest.preloads ?? []) {
      const attrs = getScriptPreloadAttrs(manifest, link)
      const hint: EarlyHint = {
        href: attrs.href,
        rel: attrs.rel,
        as: 'script',
      }
      if (attrs.crossOrigin !== undefined) hint.crossOrigin = attrs.crossOrigin
      hints.push(hint)
    }

    for (const link of routeManifest.css ?? []) {
      const stylesheetHref = getStylesheetHref(link)
      if (manifest.inlineCss?.styles[stylesheetHref] !== undefined) {
        continue
      }
      const resolvedLink = resolveManifestCssLink(link)

      const hint: EarlyHint = {
        href: stylesheetHref,
        rel: 'preload',
        as: 'style',
      }
      if (resolvedLink.crossOrigin !== undefined) {
        hint.crossOrigin = resolvedLink.crossOrigin
      }
      hints.push(hint)
    }
  }

  return hints
}

export function collectDynamicHintsFromMatches(
  matches: ReadonlyArray<AnyRouteMatch>,
): Array<EarlyHint> {
  const hints: Array<EarlyHint> = []

  for (const match of matches) {
    const links = match.links
    if (!Array.isArray(links)) continue

    for (const link of links as Array<RouterManagedTag['attrs']>) {
      const hint = linkAttrsToEarlyHint(link)
      if (hint) hints.push(hint)
    }
  }

  return hints
}

export function createEarlyHintsEvent(opts: {
  phase: EarlyHintsPhase
  hints: ReadonlyArray<EarlyHint>
  sentLinks: Set<string>
  sentHints: Array<EarlyHint>
}): EarlyHintsEvent | undefined {
  const nextHints: Array<EarlyHint> = []
  const nextLinks: Array<string> = []

  for (const hint of opts.hints) {
    const link = serializeEarlyHint(hint)
    if (opts.sentLinks.has(link)) continue
    opts.sentLinks.add(link)
    opts.sentHints.push(hint)
    nextHints.push(hint)
    nextLinks.push(link)
  }

  if (!nextHints.length && opts.phase !== 'dynamic') return undefined

  return {
    phase: opts.phase,
    hints: nextHints,
    links: nextLinks,
    allHints: opts.sentHints.slice(),
    allLinks: Array.from(opts.sentLinks),
  }
}

export function createResponseLinkHeaderEntries(opts: {
  phase: EarlyHintsPhase
  hints: ReadonlyArray<EarlyHint>
  sentLinks: Set<string>
  entries: Array<ResponseLinkHeaderEntry>
}) {
  for (const hint of opts.hints) {
    const link = serializeEarlyHint(hint)
    if (opts.sentLinks.has(link)) continue

    opts.sentLinks.add(link)
    opts.entries.push({ phase: opts.phase, hint, link })
  }
}

export function getResponseLinkHeaderEntries(opts: {
  entries: ReadonlyArray<ResponseLinkHeaderEntry>
  filter?: ResponseLinkHeaderFilter
}): Array<string> {
  if (!opts.filter) {
    return opts.entries.map((entry) => entry.link)
  }

  try {
    const links: Array<string> = []

    for (const entry of opts.entries) {
      if (opts.filter(entry)) {
        links.push(entry.link)
      }
    }

    return links
  } catch (err) {
    console.error('Error filtering response Link headers:', err)
    return []
  }
}

function notifyEarlyHints(
  phase: EarlyHintsPhase,
  event: EarlyHintsEvent,
  onEarlyHints: OnEarlyHints,
) {
  try {
    const result = onEarlyHints(event)
    if (result) {
      void Promise.resolve(result).catch((err) => {
        console.error(`Error sending ${phase} early hints:`, err)
      })
    }
  } catch (err) {
    console.error(`Error sending ${phase} early hints:`, err)
  }
}

function getResponseLinkHeaderFilter(
  responseLinkHeader: boolean | ResponseLinkHeaderOptions | undefined,
): ResponseLinkHeaderFilter | undefined {
  if (typeof responseLinkHeader !== 'object') {
    return undefined
  }

  return responseLinkHeader.filter
}

function appendResponseLinkHeaders(opts: {
  responseHeaders: Headers
  entries: ReadonlyArray<ResponseLinkHeaderEntry>
  filter?: ResponseLinkHeaderFilter
}) {
  for (const link of getResponseLinkHeaderEntries(opts)) {
    opts.responseHeaders.append('Link', link)
  }
}

function collectResponseLinkHeaderEntries(opts: {
  phase: EarlyHintsPhase
  event: EarlyHintsEvent
  entries: Array<ResponseLinkHeaderEntry>
}) {
  for (let index = 0; index < opts.event.hints.length; index++) {
    opts.entries.push({
      phase: opts.phase,
      hint: opts.event.hints[index]!,
      link: opts.event.links[index]!,
    })
  }
}

function collectEarlyHintsPhase(opts: {
  phase: EarlyHintsPhase
  hints: ReadonlyArray<EarlyHint>
  sentLinks: Set<string>
  sentHints?: Array<EarlyHint>
  onEarlyHints?: OnEarlyHints
  responseLinkHeaderEntries?: Array<ResponseLinkHeaderEntry>
}) {
  const event = opts.onEarlyHints
    ? createEarlyHintsEvent({
        phase: opts.phase,
        hints: opts.hints,
        sentLinks: opts.sentLinks,
        sentHints: opts.sentHints!,
      })
    : undefined

  if (event) {
    notifyEarlyHints(opts.phase, event, opts.onEarlyHints!)
  }

  if (!opts.responseLinkHeaderEntries) return

  if (event) {
    collectResponseLinkHeaderEntries({
      phase: opts.phase,
      event,
      entries: opts.responseLinkHeaderEntries,
    })
    return
  }

  createResponseLinkHeaderEntries({
    phase: opts.phase,
    hints: opts.hints,
    sentLinks: opts.sentLinks,
    entries: opts.responseLinkHeaderEntries,
  })
}

export function createEarlyHintsCollector(
  opts:
    | {
        onEarlyHints?: OnEarlyHints
        responseLinkHeader?: boolean | ResponseLinkHeaderOptions
      }
    | undefined,
): EarlyHintsCollector | undefined {
  if (
    process.env.TSS_DEV_SERVER === 'true' ||
    (!opts?.onEarlyHints && !opts?.responseLinkHeader)
  ) {
    return undefined
  }

  const sentLinks = new Set<string>()
  const sentHints = opts.onEarlyHints ? new Array<EarlyHint>() : undefined
  const responseLinkHeaderEntries = opts.responseLinkHeader
    ? new Array<ResponseLinkHeaderEntry>()
    : undefined
  const responseLinkHeaderFilter = getResponseLinkHeaderFilter(
    opts.responseLinkHeader,
  )

  return {
    collectStatic: ({ manifest, matchedRoutes }) => {
      if (!matchedRoutes?.length) return

      collectEarlyHintsPhase({
        phase: 'static',
        hints: collectStaticHintsFromManifest(manifest, matchedRoutes),
        sentLinks,
        sentHints,
        onEarlyHints: opts.onEarlyHints,
        responseLinkHeaderEntries,
      })
    },
    collectDynamic: (matches) => {
      collectEarlyHintsPhase({
        phase: 'dynamic',
        hints: collectDynamicHintsFromMatches(matches),
        sentLinks,
        sentHints,
        onEarlyHints: opts.onEarlyHints,
        responseLinkHeaderEntries,
      })
    },
    appendResponseHeaders: (headers) => {
      if (!responseLinkHeaderEntries?.length) return

      appendResponseLinkHeaders({
        responseHeaders: headers,
        entries: responseLinkHeaderEntries,
        filter: responseLinkHeaderFilter,
      })
    },
  }
}
