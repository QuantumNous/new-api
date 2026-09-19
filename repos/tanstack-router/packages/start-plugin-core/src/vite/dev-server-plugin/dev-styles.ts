/**
 * CSS collection for dev mode.
 * Crawls the Vite module graph to collect CSS from the router entry and all its dependencies.
 */
import path from 'node:path'
import type { ModuleNode, ViteDevServer } from 'vite'

// CSS file extensions supported by Vite
const CSS_FILE_REGEX =
  /\.(css|less|sass|scss|styl|stylus|pcss|postcss|sss)(?:$|\?)/
// CSS modules file pattern - exported for use in plugin hook filters
// Note: allow query/hash suffix since Vite ids often include them.
export const CSS_MODULES_REGEX =
  /\.module\.(css|less|sass|scss|styl|stylus)(?:$|[?#])/i

export function normalizeCssModuleCacheKey(idOrFile: string): string {
  const baseId = idOrFile.split('?')[0]!.split('#')[0]!
  return baseId.replace(/\\/g, '/')
}
// URL params that indicate CSS should not be injected (e.g., ?url, ?inline)
const CSS_SIDE_EFFECT_FREE_PARAMS = ['url', 'inline', 'raw', 'inline-css']

// Marker to find the CSS string in Vite's transformed output
const VITE_CSS_MARKER = 'const __vite__css = '

const ESCAPE_CSS_COMMENT_START_REGEX = /\/\*/g
const ESCAPE_CSS_COMMENT_END_REGEX = /\*\//g

function isCssFile(file: string): boolean {
  return CSS_FILE_REGEX.test(file)
}

export function isCssModulesFile(file: string): boolean {
  return CSS_MODULES_REGEX.test(file)
}

function hasCssSideEffectFreeParam(url: string): boolean {
  const queryString = url.split('?')[1]
  if (!queryString) return false

  const params = new URLSearchParams(queryString)
  return CSS_SIDE_EFFECT_FREE_PARAMS.some(
    (param) =>
      params.get(param) === '' &&
      !url.includes(`?${param}=`) &&
      !url.includes(`&${param}=`),
  )
}

/**
 * Resolve a file path to a Vite dev server URL.
 * Files within the root directory use relative paths, files outside use /@fs prefix.
 */
function resolveDevUrl(rootDirectory: string, filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const relativePath = path.posix.relative(
    rootDirectory.replace(/\\/g, '/'),
    normalizedPath,
  )
  const isWithinRoot =
    !relativePath.startsWith('..') && !path.isAbsolute(relativePath)

  if (isWithinRoot) {
    return path.posix.join('/', relativePath)
  }
  // Files outside root need /@fs prefix
  return path.posix.join('/@fs', normalizedPath)
}

export interface CollectDevStylesOptions {
  viteDevServer: ViteDevServer
  entries: Array<string>
  /** Cache of CSS modules content captured during transform hook */
  cssModulesCache?: Record<string, string>
}

/**
 * Collect CSS content from the module graph starting from the given entry points.
 */
export async function collectDevStyles(
  opts: CollectDevStylesOptions,
): Promise<string | undefined> {
  const { viteDevServer, entries, cssModulesCache = {} } = opts
  const styles: Map<string, string> = new Map()
  const visited = new Set<ModuleNode>()

  const rootDirectory = viteDevServer.config.root

  // Process entries in parallel - each entry is independent
  await Promise.all(
    entries.map((entry) =>
      processEntry(viteDevServer, resolveDevUrl(rootDirectory, entry), visited),
    ),
  )

  // Collect CSS from visited modules in parallel
  const cssPromises: Array<Promise<readonly [string, string] | null>> = []

  for (const dep of visited) {
    if (hasCssSideEffectFreeParam(dep.url)) {
      continue
    }

    if (dep.file && isCssModulesFile(dep.file)) {
      const css = cssModulesCache[normalizeCssModuleCacheKey(dep.file)]
      if (!css) {
        // skip this module - it may not be a real CSS module or it may not have been transformed yet
        continue
      }
      styles.set(dep.url, css)
      continue
    }

    const fileOrUrl = dep.file ?? dep.url
    if (!isCssFile(fileOrUrl)) {
      continue
    }

    // Load regular CSS files in parallel
    cssPromises.push(
      fetchCssFromModule(viteDevServer, dep).then((css) =>
        css ? ([dep.url, css] as const) : null,
      ),
    )
  }

  // Wait for all CSS loads to complete
  const cssResults = await Promise.all(cssPromises)
  for (const result of cssResults) {
    if (result) {
      styles.set(result[0], result[1])
    }
  }

  if (styles.size === 0) return undefined

  const parts: Array<string> = []
  for (const [fileName, css] of styles.entries()) {
    const escapedFileName = fileName
      .replace(ESCAPE_CSS_COMMENT_START_REGEX, '/\\*')
      .replace(ESCAPE_CSS_COMMENT_END_REGEX, '*\\/')
    parts.push(`\n/* ${escapedFileName} */\n${css}`)
  }
  return parts.join('\n')
}

/**
 * Process an entry URL: transform it if needed, get the module node, and crawl its dependencies.
 */
async function processEntry(
  viteDevServer: ViteDevServer,
  entryUrl: string,
  visited: Set<ModuleNode>,
): Promise<void> {
  let node = await viteDevServer.moduleGraph.getModuleByUrl(entryUrl)

  // Only transform if not yet SSR-transformed (need ssrTransformResult.deps for crawling)
  if (!node?.ssrTransformResult) {
    try {
      await viteDevServer.transformRequest(entryUrl)
    } catch {
      // ignore - module might not exist yet
    }
    node = await viteDevServer.moduleGraph.getModuleByUrl(entryUrl)
  }

  if (!node || visited.has(node)) return

  visited.add(node)
  await findModuleDeps(viteDevServer, node, visited)
}

/**
 * Find all module dependencies by crawling the module graph.
 * Uses transformResult.deps for URL-based lookups (parallel) and
 * importedModules for already-resolved nodes (parallel).
 */
async function findModuleDeps(
  viteDevServer: ViteDevServer,
  node: ModuleNode,
  visited: Set<ModuleNode>,
): Promise<void> {
  // Note: caller must add node to visited BEFORE calling this function
  // to prevent race conditions with parallel traversal

  // Process deps from transformResult if available (URLs including bare imports)
  const deps =
    node.ssrTransformResult?.deps ?? node.transformResult?.deps ?? null

  const importedModules = node.importedModules

  // Fast path: no deps and no imports
  if ((!deps || deps.length === 0) && importedModules.size === 0) {
    return
  }

  // Build branches only when needed (avoid array allocation on leaf nodes)
  const branches: Array<Promise<void>> = []

  if (deps) {
    for (const depUrl of deps) {
      const dep = await viteDevServer.moduleGraph.getModuleByUrl(depUrl)
      if (!dep) continue

      if (visited.has(dep)) continue
      visited.add(dep)
      branches.push(findModuleDeps(viteDevServer, dep, visited))
    }
  }

  // ALWAYS also traverse importedModules - this catches:
  // - Code-split chunks (e.g. ?tsr-split=component) not in deps
  // - Already-resolved nodes
  for (const depNode of importedModules) {
    if (visited.has(depNode)) continue
    visited.add(depNode)
    branches.push(findModuleDeps(viteDevServer, depNode, visited))
  }

  if (branches.length === 1) {
    await branches[0]
    return
  }

  await Promise.all(branches)
}

async function fetchCssFromModule(
  viteDevServer: ViteDevServer,
  node: ModuleNode,
): Promise<string | undefined> {
  // Use cached transform result if available
  const cachedCode = node.transformResult?.code ?? node.ssrTransformResult?.code
  if (cachedCode) {
    return extractCssFromCode(cachedCode)
  }

  // Otherwise request a fresh transform
  try {
    const transformResult = await viteDevServer.transformRequest(node.url)
    if (!transformResult?.code) return undefined

    return extractCssFromCode(transformResult.code)
  } catch {
    // Preprocessor partials (e.g., Sass files with mixins) can't compile in isolation.
    // The root stylesheet that @imports them will contain the compiled CSS.
    return undefined
  }
}

/**
 * Extract CSS content from Vite's transformed CSS module code.
 *
 * Vite embeds CSS into the module as a JS string via `JSON.stringify(cssContent)`,
 * e.g. `const __vite__css = ${JSON.stringify('...css...')}`.
 *
 * We locate that JSON string literal and run `JSON.parse` on it to reverse the
 * escaping (\\n, \\t, \\", \\\\, \\uXXXX, etc.).
 */
export function extractCssFromCode(code: string): string | undefined {
  const startIdx = code.indexOf(VITE_CSS_MARKER)
  if (startIdx === -1) return undefined

  const valueStart = startIdx + VITE_CSS_MARKER.length
  // Vite emits `const __vite__css = ${JSON.stringify(cssContent)}` which always
  // produces double-quoted JSON string literals.
  if (code.charCodeAt(valueStart) !== 34) return undefined

  const codeLength = code.length
  let i = valueStart + 1
  while (i < codeLength) {
    const charCode = code.charCodeAt(i)
    // 34 = '"'
    if (charCode === 34) {
      try {
        return JSON.parse(code.slice(valueStart, i + 1))
      } catch {
        return undefined
      }
    }
    // 92 = '\\'
    if (charCode === 92) {
      i += 2
    } else {
      i++
    }
  }

  return undefined
}
