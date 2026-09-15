import { tsrSplit } from '@tanstack/router-plugin'
import { tssHydrate } from '../hydration-constants'
import { getCssAssetSource } from '../start-manifest-plugin/inlineCss'
import { RSBUILD_ENVIRONMENT_NAMES } from './planning'
import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'
import type { NormalizedClientBuild, NormalizedClientChunk } from '../types'

type ProcessAssetsContext = Parameters<
  Parameters<RsbuildPluginAPI['processAssets']>[1]
>[0]
type RspackCompilation = Rspack.Compilation
type RspackCompilationChunk = Rspack.Chunk
type RspackModule = Rspack.Module

/**
 * Extract route file paths from rspack module identifiers.
 *
 * In rspack, module identifiers contain query params similar to Vite's moduleIds.
 * We look for the `tsr-split` query to identify route-split chunks.
 */
function getRouteFilePathsFromModules(
  modules: Array<RspackModule>,
): Array<string> {
  let routeFilePaths: Array<string> | undefined
  let seen: Set<string> | undefined

  for (const mod of modules) {
    const identifier = mod.identifier()

    // rspack module identifiers include loader prefixes separated by '!'.
    // The actual file path (with query string) is after the last '!'.
    // Example: "builtin:swc-loader??ruleSet[...]!.../transform.js??...!.../rsc-basic.tsx?tsr-split=component"
    const lastBangIndex = identifier.lastIndexOf('!')
    const resourcePart =
      lastBangIndex >= 0 ? identifier.slice(lastBangIndex + 1) : identifier

    const queryIndex = resourcePart.indexOf('?')
    if (queryIndex < 0) continue

    const query = resourcePart.slice(queryIndex + 1)
    if (!query.includes(tsrSplit)) continue
    if (!new URLSearchParams(query).has(tsrSplit)) continue

    const nameForCondition = mod.nameForCondition()
    const routeFilePath = nameForCondition ?? resourcePart.slice(0, queryIndex)

    if (seen?.has(routeFilePath)) continue

    if (!routeFilePaths || !seen) {
      routeFilePaths = []
      seen = new Set()
    }

    routeFilePaths.push(routeFilePath)
    seen.add(routeFilePath)
  }

  return routeFilePaths ?? []
}

function getHydrationIdsFromModules(
  modules: Array<RspackModule>,
): Array<string> {
  let hydrationIds: Array<string> | undefined
  let seen: Set<string> | undefined

  for (const mod of modules) {
    const identifier = mod.identifier()
    const lastBangIndex = identifier.lastIndexOf('!')
    const resourcePart =
      lastBangIndex >= 0 ? identifier.slice(lastBangIndex + 1) : identifier

    const queryIndex = resourcePart.indexOf('?')
    if (queryIndex < 0) continue

    const query = resourcePart.slice(queryIndex + 1)
    if (!query.includes(tssHydrate)) continue

    const hydrationId = new URLSearchParams(query).get(tssHydrate)
    if (!hydrationId || seen?.has(hydrationId)) continue

    if (!hydrationIds || !seen) {
      hydrationIds = []
      seen = new Set()
    }

    hydrationIds.push(hydrationId)
    seen.add(hydrationId)
  }

  return hydrationIds ?? []
}

/**
 * Returns true for Rspack/webpack HMR runtime chunks that should never be
 * surfaced to the Start manifest. These files are emitted on every rebuild
 * (e.g. `index.<hash>.hot-update.mjs`) and must not be treated as the entry
 * chunk, route preloads, or sibling imports.
 */
function isHotUpdateAsset(file: string): boolean {
  return file.includes('.hot-update.')
}

/**
 * True for any JS/MJS asset that should be included in the manifest.
 * Excludes HMR runtime patches.
 */
function isManifestJsAsset(file: string): boolean {
  if (!file.endsWith('.js') && !file.endsWith('.mjs')) return false
  return !isHotUpdateAsset(file)
}

/**
 * Get all JS file names from a chunk.
 */
function getChunkJsFiles(chunk: RspackCompilationChunk): Array<string> {
  const jsFiles: Array<string> = []
  for (const file of chunk.files) {
    if (isManifestJsAsset(file)) {
      jsFiles.push(file)
    }
  }
  return jsFiles
}

/**
 * Compute dynamicImports for a chunk by traversing its chunk groups'
 * childrenIterable (async/dynamic import edges).
 *
 * In rspack, a chunk belongs to one or more ChunkGroups. Each ChunkGroup
 * has childrenIterable — child ChunkGroups representing dynamic import()
 * points. The JS files from those child groups' chunks are the
 * dynamicImports (analogous to Rollup's OutputChunk.dynamicImports).
 */
function computeDynamicImports(chunk: RspackCompilationChunk): Array<string> {
  const dynamicImportFiles: Array<string> = []
  const seen = new Set<string>()

  for (const group of chunk.groupsIterable) {
    for (const childGroup of group.childrenIterable) {
      for (const childChunk of childGroup.chunks) {
        for (const file of childChunk.files) {
          if (isManifestJsAsset(file) && !seen.has(file)) {
            seen.add(file)
            dynamicImportFiles.push(file)
          }
        }
      }
    }
  }

  return dynamicImportFiles
}

/**
 * Compute static imports (sibling chunks) for an async chunk.
 *
 * In rspack/webpack, an async chunk's ChunkGroup contains ALL chunks needed to
 * satisfy that dynamic import — the async chunk itself plus any shared/vendor
 * chunks it statically imports. This is analogous to Rollup's
 * `OutputChunk.imports` for async chunks.
 *
 * We collect JS files from all sibling chunks in the group (excluding the
 * current chunk's own file) to populate the `imports` field.
 */
function computeAsyncChunkImports(
  chunk: RspackCompilationChunk,
  currentFile: string,
): Array<string> {
  const imports: Array<string> = []
  const seen = new Set<string>()
  seen.add(currentFile)

  for (const group of chunk.groupsIterable) {
    for (const siblingChunk of group.chunks) {
      for (const file of siblingChunk.files) {
        if (isManifestJsAsset(file) && !seen.has(file)) {
          seen.add(file)
          imports.push(file)
        }
      }
    }
  }

  return imports
}

/**
 * Normalize an rspack compilation into a NormalizedClientBuild.
 *
 * Iterates ALL chunks in the compilation (initial + async), not just
 * entrypoint chunks, to ensure route-split async chunks are included.
 */
export function normalizeRspackClientBuild(
  compilation: RspackCompilation,
): NormalizedClientBuild {
  const chunksByFileName = new Map<string, NormalizedClientChunk>()
  const chunkFileNamesByRouteFilePath = new Map<string, Array<string>>()
  const cssFilesBySourcePath = new Map<string, Array<string>>()
  const cssContentByFileName = new Map<string, string>()
  let entryChunkFileName: string | undefined

  // Collect all initial JS file names from the main entry for computing
  // the entry chunk's `imports` (vendor/shared sibling chunks).
  const entrypoint = compilation.entrypoints.get('index')
  const initialJsFileNames: Array<string> = []
  const entryChunkSet = new Set<RspackCompilationChunk>()
  if (entrypoint) {
    for (const chunk of entrypoint.chunks) {
      entryChunkSet.add(chunk)
      for (const file of chunk.files) {
        if (isManifestJsAsset(file)) {
          initialJsFileNames.push(file)
        }
      }
    }
  }

  // Iterate ALL chunks (initial + async) to capture route-split chunks
  for (const chunk of compilation.chunks) {
    const modules = compilation.chunkGraph.getChunkModules(chunk)
    const routeFilePaths = getRouteFilePathsFromModules(modules)
    const hydrationIds = getHydrationIdsFromModules(modules)
    const cssFiles: Array<string> = []
    const seenCssFiles = new Set<string>()

    for (const auxFile of chunk.auxiliaryFiles) {
      if (auxFile.endsWith('.css') && !seenCssFiles.has(auxFile)) {
        seenCssFiles.add(auxFile)
        cssFiles.push(auxFile)
      }
    }

    for (const mainFile of chunk.files) {
      if (mainFile.endsWith('.css') && !seenCssFiles.has(mainFile)) {
        seenCssFiles.add(mainFile)
        cssFiles.push(mainFile)
      }
    }

    if (cssFiles.length > 0) {
      for (const mod of modules) {
        const sourcePath = mod.nameForCondition()
        if (!sourcePath) continue

        const existing = cssFilesBySourcePath.get(sourcePath)
        cssFilesBySourcePath.set(
          sourcePath,
          existing ? appendUniqueStrings(existing, cssFiles) : cssFiles.slice(),
        )
      }
    }

    // The entry chunk is the one named 'index' in the 'index' entrypoint
    const isEntryChunk = chunk.name === 'index' && entryChunkSet.has(chunk)

    const jsFiles = getChunkJsFiles(chunk)
    if (jsFiles.length === 0) continue

    // Compute dynamicImports from chunk group children
    const dynamicImports = computeDynamicImports(chunk)

    for (const file of jsFiles) {
      // For the entry chunk, `imports` contains all sibling initial chunks
      // (vendor/shared). For async chunks, `imports` contains all sibling
      // chunks from the ChunkGroup (shared dependencies the browser must
      // load alongside this chunk). This mirrors Rollup's
      // OutputChunk.imports which lists statically imported chunks.
      const imports = isEntryChunk
        ? initialJsFileNames.filter((f) => f !== file)
        : computeAsyncChunkImports(chunk, file)

      const normalizedChunk: NormalizedClientChunk = {
        fileName: file,
        isEntry: isEntryChunk,
        imports,
        dynamicImports,
        css: [],
        routeFilePaths,
        hydrationIds,
      }

      chunksByFileName.set(file, normalizedChunk)

      if (isEntryChunk && !entryChunkFileName) {
        entryChunkFileName = file
      }

      for (const routeFilePath of routeFilePaths) {
        let chunkFileNames = chunkFileNamesByRouteFilePath.get(routeFilePath)
        if (!chunkFileNames) {
          chunkFileNames = []
          chunkFileNamesByRouteFilePath.set(routeFilePath, chunkFileNames)
        }
        chunkFileNames.push(file)
      }
    }

    for (const cssFile of cssFiles) {
      for (const file of jsFiles) {
        const existing = chunksByFileName.get(file)
        if (existing && !existing.css.includes(cssFile)) {
          existing.css.push(cssFile)
        }
      }
    }
  }

  if (!entryChunkFileName) {
    throw new Error('No entry file found in rspack client build')
  }

  for (const asset of compilation.getAssets()) {
    if (!asset.name.endsWith('.css')) {
      continue
    }

    const css = getCssAssetSource(asset.source.source())
    if (css !== undefined) {
      cssContentByFileName.set(asset.name, css)
    }
  }

  // In RSC mode, CSS from server components is associated with the 'rsc'
  // client entry chunk (not the main 'index' entry). The manifest builder
  // merges the entry chunk's CSS into __root__, so by appending RSC CSS
  // to the entry chunk, those stylesheets get loaded on all pages.
  // CSS may appear in either `files` or `auxiliaryFiles` depending on
  // rspack's CSS extraction strategy.
  const rscEntrypoint = compilation.entrypoints.get('rsc')

  if (rscEntrypoint && entryChunkFileName) {
    const mainEntryChunk = chunksByFileName.get(entryChunkFileName)
    if (mainEntryChunk) {
      for (const rscChunk of rscEntrypoint.chunks) {
        const allFiles = [...rscChunk.files, ...rscChunk.auxiliaryFiles]
        for (const file of allFiles) {
          if (file.endsWith('.css') && !mainEntryChunk.css.includes(file)) {
            mainEntryChunk.css.push(file)
          }
        }
      }
    }
  }

  return {
    entryChunkFileName,
    chunksByFileName,
    chunkFileNamesByRouteFilePath,
    cssFilesBySourcePath,
    cssContentByFileName,
  }
}

function appendUniqueStrings(
  target: Array<string>,
  source: Array<string>,
): Array<string> {
  const seen = new Set(target)
  let result: Array<string> | undefined

  for (const value of source) {
    if (seen.has(value)) continue
    seen.add(value)
    if (!result) {
      result = target.slice()
    }
    result.push(value)
  }

  return result ?? target
}

/**
 * Registers a processAssets hook to capture the client build stats
 * after compilation. Returns a getter for the captured build.
 */
export function registerClientBuildCapture(api: RsbuildPluginAPI): {
  getClientBuild: () => NormalizedClientBuild | undefined
} {
  let clientBuild: NormalizedClientBuild | undefined

  api.processAssets(
    {
      stage: 'report',
      environments: [RSBUILD_ENVIRONMENT_NAMES.client],
    },
    (context: ProcessAssetsContext) => {
      clientBuild = normalizeRspackClientBuild(context.compilation)
    },
  )

  return {
    getClientBuild: () => clientBuild,
  }
}
