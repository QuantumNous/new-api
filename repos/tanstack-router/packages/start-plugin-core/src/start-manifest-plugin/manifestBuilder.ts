/* eslint-disable @typescript-eslint/prefer-for-of */
import { serialize } from 'seroval'
import { joinURL } from 'ufo'
import {
  getStylesheetHref,
  resolveManifestAssetLink,
  resolveManifestCssLink,
  rootRouteId,
} from '@tanstack/router-core'
import { processInlineCssUrls } from './inlineCss'
import type {
  ManifestAssetLink,
  ManifestCssLink,
  ManifestScript,
  ScriptFormat,
} from '@tanstack/router-core'
import type { InlineCssTemplate } from './inlineCss'
import type { NormalizedClientBuild, NormalizedClientChunk } from '../types'

const VISITING_CHUNK = 1

type RouteTreeRoute = {
  filePath?: string
  preloads?: Array<string>
  scripts?: Array<ManifestScript>
  css?: Array<ManifestCssLink>
  children?: Array<string>
}

type RouteTreeRoutes = Record<string, RouteTreeRoute>

type AdditionalRouteManifestEntry = ManifestCssLink | ManifestScript

interface ScannedClientChunks {
  entryChunk: NormalizedClientChunk
  chunksByFileName: ReadonlyMap<string, NormalizedClientChunk>
  routeChunksByFilePath: ReadonlyMap<string, Array<NormalizedClientChunk>>
}

interface ManifestAssetResolvers {
  getAssetPath: (fileName: string) => string
  getChunkPreloads: (chunk: NormalizedClientChunk) => Array<string>
  getStylesheetLink: (cssFile: string) => ManifestCssLink
}

type DedupeRoute = {
  preloads?: Array<ManifestAssetLink>
  scripts?: Array<ManifestScript>
  css?: Array<ManifestCssLink>
  children?: Array<string>
}

export interface StartManifest {
  scriptFormat?: ScriptFormat
  routes: Record<string, RouteTreeRoute>
  inlineCss?: {
    styles: Record<string, string>
    templates?: Record<string, InlineCssTemplate>
  }
}

export interface InlineCssOptions {
  enabled: boolean
  transformAssets: boolean
}

export function appendUniqueStrings(
  target: Array<string> | undefined,
  source: Array<string>,
) {
  // Similar to Set.prototype.union, but for ordered arrays.
  // It preserves first-seen order and returns the original target array when
  // source contributes no new values, which avoids extra allocations.
  if (source.length === 0) {
    return target
  }

  if (!target || target.length === 0) {
    return source
  }

  const seen = new Set(target)
  let result: Array<string> | undefined

  for (const value of source) {
    if (seen.has(value)) {
      continue
    }

    seen.add(value)
    if (!result) {
      result = target.slice()
    }
    result.push(value)
  }

  return result ?? target
}

function appendUniqueStylesheets(
  target: Array<ManifestCssLink> | undefined,
  source: Array<ManifestCssLink>,
) {
  if (source.length === 0) {
    return target
  }

  if (!target || target.length === 0) {
    return source
  }

  const seen = new Set(target.map(getStylesheetIdentity))
  let result: Array<ManifestCssLink> | undefined

  for (const stylesheet of source) {
    const identity = getStylesheetIdentity(stylesheet)
    if (seen.has(identity)) {
      continue
    }

    seen.add(identity)
    if (!result) {
      result = target.slice()
    }
    result.push(stylesheet)
  }

  return result ?? target
}

function getStylesheetIdentity(attrs: ManifestCssLink) {
  const resolved = resolveManifestCssLink(attrs)
  return `${resolved.href}\0${resolved.crossOrigin ?? ''}`
}

function getScriptIdentity(script: ManifestScript) {
  return JSON.stringify({
    attrs: normalizeAttrs(script.attrs),
    children: script.children ?? null,
  })
}

function normalizeAttrs(attrs: Record<string, any> | undefined) {
  if (!attrs) {
    return null
  }

  const entries = Object.entries(attrs)
  if (entries.length === 0) {
    return null
  }

  entries.sort(([left], [right]) => left.localeCompare(right))
  return Object.fromEntries(entries)
}

function mergeRouteChunkData(options: {
  route: RouteTreeRoute
  chunk: NormalizedClientChunk
  getChunkCssAssets: (chunk: NormalizedClientChunk) => Array<ManifestCssLink>
  getChunkPreloads: (chunk: NormalizedClientChunk) => Array<string>
}) {
  const stylesheets = options.getChunkCssAssets(options.chunk)
  const chunkPreloads = options.getChunkPreloads(options.chunk)

  appendRouteStylesheets(options.route, stylesheets)
  options.route.preloads = appendUniqueStrings(
    options.route.preloads,
    chunkPreloads,
  )
}

function appendRouteStylesheets(
  route: RouteTreeRoute,
  stylesheets: Array<ManifestCssLink>,
) {
  if (stylesheets.length === 0) {
    return
  }

  route.css = appendUniqueStylesheets(route.css, stylesheets)
}

function appendRouteScripts(
  route: RouteTreeRoute,
  scripts: Array<ManifestScript>,
) {
  if (scripts.length === 0) {
    return
  }

  route.scripts = [...(route.scripts ?? []), ...scripts]
}

function buildScript(src: string, scriptFormat: ScriptFormat): ManifestScript {
  return {
    attrs: {
      ...(scriptFormat === 'module' ? { type: 'module' } : {}),
      async: true,
      src,
    },
  }
}

function appendEntryChunkScripts(options: {
  route: RouteTreeRoute
  chunk: NormalizedClientChunk
  scriptFormat: ScriptFormat
  getAssetPath: (fileName: string) => string
}) {
  const scripts: Array<ManifestScript> = []

  if (options.scriptFormat === 'iife') {
    for (let i = 0; i < options.chunk.imports.length; i++) {
      scripts.push(
        buildScript(
          options.getAssetPath(options.chunk.imports[i]!),
          options.scriptFormat,
        ),
      )
    }
  }

  scripts.push(
    buildScript(
      options.getAssetPath(options.chunk.fileName),
      options.scriptFormat,
    ),
  )

  appendRouteScripts(options.route, scripts)
}

function appendAdditionalRouteEntries(
  route: RouteTreeRoute,
  entries: ReadonlyArray<AdditionalRouteManifestEntry>,
) {
  if (entries.length === 0) {
    return
  }

  const stylesheets: Array<ManifestCssLink> = []
  const scripts: Array<ManifestScript> = []

  for (const entry of entries) {
    if (typeof entry === 'string' || 'href' in entry) {
      stylesheets.push(entry)
    } else {
      scripts.push(entry)
    }
  }

  appendRouteStylesheets(route, stylesheets)
  appendRouteScripts(route, scripts)
}

export function buildStartManifest(options: {
  clientBuild: NormalizedClientBuild
  routeTreeRoutes: RouteTreeRoutes
  basePath: string
  inlineCss?: InlineCssOptions
  scriptFormat?: ScriptFormat
  additionalRouteAssets?: Partial<
    Record<string, ReadonlyArray<AdditionalRouteManifestEntry>>
  >
}): StartManifest {
  const scannedChunks = scanClientChunks(options.clientBuild)
  const assetResolvers = createManifestAssetResolvers(options.basePath)

  const routes = buildRouteManifestRoutes({
    routeTreeRoutes: options.routeTreeRoutes,
    routeChunksByFilePath: scannedChunks.routeChunksByFilePath,
    chunksByFileName: scannedChunks.chunksByFileName,
    entryChunk: scannedChunks.entryChunk,
    assetResolvers,
    additionalRouteAssets: options.additionalRouteAssets,
  })

  appendEntryChunkScripts({
    route: routes[rootRouteId]!,
    chunk: scannedChunks.entryChunk,
    scriptFormat: options.scriptFormat ?? 'module',
    getAssetPath: assetResolvers.getAssetPath,
  })

  dedupeNestedRouteManifestEntries(rootRouteId, routes[rootRouteId]!, routes)

  // Prune routes with no manifest data
  for (const routeId in routes) {
    const route = routes[routeId]!
    const hasScripts = route.scripts && route.scripts.length > 0
    const hasCssLinks = route.css && route.css.length > 0
    const hasPreloads = route.preloads && route.preloads.length > 0
    if (!hasScripts && !hasCssLinks && !hasPreloads) {
      delete routes[routeId]
    }
  }

  const result: StartManifest = {
    routes,
  }

  if (options.scriptFormat === 'iife') {
    result.scriptFormat = 'iife'
  }

  if (options.inlineCss?.enabled) {
    result.inlineCss = buildInlineCssManifestData({
      routes,
      basePath: options.basePath,
      cssContentByFileName: options.clientBuild.cssContentByFileName,
      transformAssets: options.inlineCss.transformAssets,
    })
  }

  return result
}

export function serializeStartManifest(startManifest: StartManifest) {
  return serialize(startManifest)
}

export function scanClientChunks(
  clientBuild: NormalizedClientBuild,
): ScannedClientChunks {
  const entryChunk = clientBuild.chunksByFileName.get(
    clientBuild.entryChunkFileName,
  )

  if (!entryChunk) {
    throw new Error(`Missing entry chunk: ${clientBuild.entryChunkFileName}`)
  }

  const routeChunksByFilePath = new Map<string, Array<NormalizedClientChunk>>()

  for (const chunk of clientBuild.chunksByFileName.values()) {
    if (chunk.routeFilePaths.length > 0) {
      for (const routeFilePath of chunk.routeFilePaths) {
        let chunks = routeChunksByFilePath.get(routeFilePath)
        if (chunks === undefined) {
          chunks = []
          routeChunksByFilePath.set(routeFilePath, chunks)
        }
        chunks.push(chunk)
      }
    }
  }

  return {
    entryChunk,
    chunksByFileName: clientBuild.chunksByFileName,
    routeChunksByFilePath,
  }
}

export function createManifestAssetResolvers(
  basePath: string,
): ManifestAssetResolvers {
  const assetPathByFileName = new Map<string, string>()
  const stylesheetLinkByFileName = new Map<string, ManifestCssLink>()
  const preloadsByChunk = new Map<NormalizedClientChunk, Array<string>>()

  const getAssetPath = (fileName: string) => {
    const cachedPath = assetPathByFileName.get(fileName)
    if (cachedPath) {
      return cachedPath
    }

    const assetPath = joinURL(basePath, fileName)
    assetPathByFileName.set(fileName, assetPath)
    return assetPath
  }

  const getStylesheetLink = (cssFile: string) => {
    const cachedLink = stylesheetLinkByFileName.get(cssFile)
    if (cachedLink) {
      return cachedLink
    }

    const href = getAssetPath(cssFile)
    const link = href satisfies ManifestCssLink

    stylesheetLinkByFileName.set(cssFile, link)
    return link
  }

  const getChunkPreloads = (chunk: NormalizedClientChunk) => {
    const cachedPreloads = preloadsByChunk.get(chunk)
    if (cachedPreloads) {
      return cachedPreloads
    }

    const preloads = [getAssetPath(chunk.fileName)]

    for (let i = 0; i < chunk.imports.length; i++) {
      preloads.push(getAssetPath(chunk.imports[i]!))
    }

    preloadsByChunk.set(chunk, preloads)
    return preloads
  }

  return {
    getAssetPath,
    getChunkPreloads,
    getStylesheetLink,
  }
}

export function createChunkCssAssetCollector(options: {
  chunksByFileName: ReadonlyMap<string, NormalizedClientChunk>
  getStylesheetLink: (cssFile: string) => ManifestCssLink
}) {
  const linksByChunk = new Map<NormalizedClientChunk, Array<ManifestCssLink>>()
  const stateByChunk = new Map<NormalizedClientChunk, number>()

  const appendAsset = (
    links: Array<ManifestCssLink>,
    seenLinks: Set<ManifestCssLink>,
    link: ManifestCssLink,
  ) => {
    if (seenLinks.has(link)) {
      return
    }

    seenLinks.add(link)
    links.push(link)
  }

  const getChunkCssAssets = (
    chunk: NormalizedClientChunk,
  ): Array<ManifestCssLink> => {
    const cachedLinks = linksByChunk.get(chunk)
    if (cachedLinks) {
      return cachedLinks
    }

    if (stateByChunk.get(chunk) === VISITING_CHUNK) {
      return []
    }
    stateByChunk.set(chunk, VISITING_CHUNK)

    const links: Array<ManifestCssLink> = []
    const seenLinks = new Set<ManifestCssLink>()

    for (let i = 0; i < chunk.imports.length; i++) {
      const importedChunk = options.chunksByFileName.get(chunk.imports[i]!)
      if (!importedChunk) {
        continue
      }

      const importedLinks = getChunkCssAssets(importedChunk)
      for (let j = 0; j < importedLinks.length; j++) {
        appendAsset(links, seenLinks, importedLinks[j]!)
      }
    }

    for (const cssFile of chunk.css) {
      appendAsset(links, seenLinks, options.getStylesheetLink(cssFile))
    }

    stateByChunk.delete(chunk)
    linksByChunk.set(chunk, links)
    return links
  }

  return { getChunkCssAssets }
}

function buildInlineCssManifestData(options: {
  routes: Record<string, RouteTreeRoute>
  basePath: string
  cssContentByFileName: ReadonlyMap<string, string> | undefined
  transformAssets: boolean
}): StartManifest['inlineCss'] {
  const stylesheetHrefs = new Set<string>()

  for (const route of Object.values(options.routes)) {
    for (const link of route.css ?? []) {
      stylesheetHrefs.add(getStylesheetHref(link))
    }
  }

  if (stylesheetHrefs.size === 0) {
    return { styles: {} }
  }

  if (!options.cssContentByFileName) {
    throw new Error(
      'TanStack Start inlineCss is enabled, but the client build did not provide CSS content',
    )
  }

  const { getAssetPath } = createManifestAssetResolvers(options.basePath)
  const styles: Record<string, string> = {}
  let templates: Record<string, InlineCssTemplate> | undefined
  const missingHrefs = new Set(stylesheetHrefs)

  for (const [cssFile, css] of options.cssContentByFileName) {
    const cssHref = getAssetPath(cssFile)
    if (!stylesheetHrefs.has(cssHref)) {
      continue
    }

    const result = processInlineCssUrls({
      css,
      cssHref,
      templates: options.transformAssets,
    })

    styles[cssHref] = result.css
    if (result.template) {
      templates ||= {}
      templates[cssHref] = result.template
    }
    missingHrefs.delete(cssHref)
  }

  if (missingHrefs.size > 0) {
    throw new Error(
      `TanStack Start inlineCss could not find CSS content for: ${Array.from(
        missingHrefs,
      ).join(', ')}`,
    )
  }

  return {
    styles,
    ...(templates ? { templates } : {}),
  }
}

export function buildRouteManifestRoutes(options: {
  routeTreeRoutes: RouteTreeRoutes
  routeChunksByFilePath: ReadonlyMap<
    string,
    ReadonlyArray<NormalizedClientChunk>
  >
  chunksByFileName: ReadonlyMap<string, NormalizedClientChunk>
  entryChunk: NormalizedClientChunk
  assetResolvers: ManifestAssetResolvers
  additionalRouteAssets?: Partial<
    Record<string, ReadonlyArray<AdditionalRouteManifestEntry>>
  >
}) {
  const routes: Record<string, RouteTreeRoute> = {}
  const getChunkCssAssets = createChunkCssAssetCollector({
    chunksByFileName: options.chunksByFileName,
    getStylesheetLink: options.assetResolvers.getStylesheetLink,
  }).getChunkCssAssets

  for (const [routeId, route] of Object.entries(options.routeTreeRoutes)) {
    if (!route.filePath) {
      if (routeId === rootRouteId) {
        routes[routeId] = { ...route }
        continue
      }

      throw new Error(`expected filePath to be set for ${routeId}`)
    }

    const chunks = options.routeChunksByFilePath.get(route.filePath)
    if (!chunks) {
      routes[routeId] = { ...route }
      continue
    }

    const existing = routes[routeId]
    const targetRoute = (routes[routeId] = existing ? existing : { ...route })

    for (const chunk of chunks) {
      mergeRouteChunkData({
        route: targetRoute,
        chunk,
        getChunkCssAssets,
        getChunkPreloads: options.assetResolvers.getChunkPreloads,
      })

      if (routeId !== rootRouteId) {
        mergeReachableHydrationChunkData({
          route: targetRoute,
          chunk,
          chunksByFileName: options.chunksByFileName,
          getChunkCssAssets,
        })
      }
    }
  }

  const rootRoute = (routes[rootRouteId] = routes[rootRouteId] || {})
  const rootRouteTreeRoute = options.routeTreeRoutes[rootRouteId]
  const rootRouteChunks = rootRouteTreeRoute?.filePath
    ? options.routeChunksByFilePath.get(rootRouteTreeRoute.filePath)
    : undefined

  if (rootRouteChunks) {
    for (const chunk of rootRouteChunks) {
      mergeReachableHydrationChunkData({
        route: rootRoute,
        chunk,
        chunksByFileName: options.chunksByFileName,
        getChunkCssAssets,
      })
    }
  }

  mergeRouteChunkData({
    route: rootRoute,
    chunk: options.entryChunk,
    getChunkCssAssets,
    getChunkPreloads: options.assetResolvers.getChunkPreloads,
  })

  if (options.additionalRouteAssets) {
    for (const [routeId, assets] of Object.entries(
      options.additionalRouteAssets,
    )) {
      if (!assets || assets.length === 0) {
        continue
      }

      if (!(routeId in options.routeTreeRoutes)) {
        throw new Error(
          `expected additionalRouteAssets routeId to exist in routeTreeRoutes: ${routeId}`,
        )
      }

      const route = (routes[routeId] = routes[routeId] || {})
      appendAdditionalRouteEntries(route, assets)
    }
  }

  return routes
}

function mergeReachableHydrationChunkData(options: {
  route: RouteTreeRoute
  chunk: NormalizedClientChunk
  chunksByFileName: ReadonlyMap<string, NormalizedClientChunk>
  getChunkCssAssets: (chunk: NormalizedClientChunk) => Array<ManifestCssLink>
}) {
  const visitedStaticChunks = new Set<string>()
  const mergedHydrationChunks = new Set<string>()

  const mergeHydrationChunk = (chunk: NormalizedClientChunk) => {
    if (mergedHydrationChunks.has(chunk.fileName)) {
      return
    }
    mergedHydrationChunks.add(chunk.fileName)

    appendRouteStylesheets(options.route, options.getChunkCssAssets(chunk))

    for (const dynamicImport of chunk.dynamicImports) {
      const dynamicChunk = options.chunksByFileName.get(dynamicImport)
      if (dynamicChunk?.hydrationIds.length) {
        mergeHydrationChunk(dynamicChunk)
      }
    }
  }

  const visitStaticChunk = (chunk: NormalizedClientChunk) => {
    if (visitedStaticChunks.has(chunk.fileName)) {
      return
    }
    visitedStaticChunks.add(chunk.fileName)

    for (const importedFileName of chunk.imports) {
      const importedChunk = options.chunksByFileName.get(importedFileName)
      if (importedChunk) {
        visitStaticChunk(importedChunk)
      }
    }

    for (const dynamicImport of chunk.dynamicImports) {
      const dynamicChunk = options.chunksByFileName.get(dynamicImport)
      if (dynamicChunk?.hydrationIds.length) {
        mergeHydrationChunk(dynamicChunk)
      }
    }
  }

  visitStaticChunk(options.chunk)
}

function dedupeNestedRouteManifestEntries(
  routeId: string,
  route: DedupeRoute,
  routesById: Record<string, DedupeRoute>,
  seenPreloads = new Set<string>(),
  seenScripts = new Set<string>(),
  seenStylesheets = new Set<string>(),
) {
  let routePreloads = route.preloads
  let routeScripts = route.scripts
  let routeStylesheets = route.css

  if (routePreloads && routePreloads.length > 0) {
    let dedupedPreloads: Array<ManifestAssetLink> | undefined

    for (let i = 0; i < routePreloads.length; i++) {
      const preload = routePreloads[i]!
      const preloadHref = resolveManifestAssetLink(preload).href

      if (seenPreloads.has(preloadHref)) {
        if (dedupedPreloads === undefined) {
          dedupedPreloads = routePreloads.slice(0, i)
        }
        continue
      }

      seenPreloads.add(preloadHref)

      if (dedupedPreloads) {
        dedupedPreloads.push(preload)
      }
    }

    if (dedupedPreloads) {
      routePreloads = dedupedPreloads
      route.preloads = dedupedPreloads
    }
  }

  if (routeScripts && routeScripts.length > 0) {
    let dedupedScripts: Array<ManifestScript> | undefined

    for (let i = 0; i < routeScripts.length; i++) {
      const script = routeScripts[i]!
      const identity = getScriptIdentity(script)

      if (seenScripts.has(identity)) {
        if (dedupedScripts === undefined) {
          dedupedScripts = routeScripts.slice(0, i)
        }
        continue
      }

      seenScripts.add(identity)

      if (dedupedScripts) {
        dedupedScripts.push(script)
      }
    }

    if (dedupedScripts) {
      routeScripts = dedupedScripts
      if (dedupedScripts.length > 0) {
        route.scripts = dedupedScripts
      } else {
        delete route.scripts
      }
    }
  }

  if (routeStylesheets && routeStylesheets.length > 0) {
    let dedupedStylesheets: Array<ManifestCssLink> | undefined

    for (let i = 0; i < routeStylesheets.length; i++) {
      const stylesheet = routeStylesheets[i]!
      const identity = getStylesheetIdentity(stylesheet)

      if (seenStylesheets.has(identity)) {
        if (dedupedStylesheets === undefined) {
          dedupedStylesheets = routeStylesheets.slice(0, i)
        }
        continue
      }

      seenStylesheets.add(identity)

      if (dedupedStylesheets) {
        dedupedStylesheets.push(stylesheet)
      }
    }

    if (dedupedStylesheets) {
      routeStylesheets = dedupedStylesheets
      if (dedupedStylesheets.length > 0) {
        route.css = dedupedStylesheets
      } else {
        delete route.css
      }
    }
  }

  if (route.children) {
    for (const childRouteId of route.children) {
      const childRoute = routesById[childRouteId]

      if (!childRoute) {
        throw new Error(
          `Route tree references child route ${childRouteId} from ${routeId}, but no route entry was found`,
        )
      }

      dedupeNestedRouteManifestEntries(
        childRouteId,
        childRoute,
        routesById,
        seenPreloads,
        seenScripts,
        seenStylesheets,
      )
    }
  }

  if (routePreloads) {
    for (let i = routePreloads.length - 1; i >= 0; i--) {
      seenPreloads.delete(resolveManifestAssetLink(routePreloads[i]!).href)
    }
  }

  if (routeScripts) {
    for (let i = routeScripts.length - 1; i >= 0; i--) {
      seenScripts.delete(getScriptIdentity(routeScripts[i]!))
    }
  }

  if (routeStylesheets) {
    for (let i = routeStylesheets.length - 1; i >= 0; i--) {
      seenStylesheets.delete(getStylesheetIdentity(routeStylesheets[i]!))
    }
  }
}
