#!/usr/bin/env node

import fs from 'node:fs'
import { promises as fsp } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parseArgs as parseNodeArgs } from 'node:util'
import vm from 'node:vm'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { execFileSync, execSync } from 'node:child_process'

import { build } from 'vite'

const BENCHMARK_NAME = 'Bundle Size (gzip)'

const SCENARIOS = [
  {
    id: 'react-router.minimal',
    dir: 'react-router-minimal',
    framework: 'react',
    packageName: '@tanstack/react-router',
    case: 'minimal',
  },
  {
    id: 'react-router.full',
    dir: 'react-router-full',
    framework: 'react',
    packageName: '@tanstack/react-router',
    case: 'full',
  },
  {
    id: 'solid-router.minimal',
    dir: 'solid-router-minimal',
    framework: 'solid',
    packageName: '@tanstack/solid-router',
    case: 'minimal',
  },
  {
    id: 'solid-router.full',
    dir: 'solid-router-full',
    framework: 'solid',
    packageName: '@tanstack/solid-router',
    case: 'full',
  },
  {
    id: 'vue-router.minimal',
    dir: 'vue-router-minimal',
    framework: 'vue',
    packageName: '@tanstack/vue-router',
    case: 'minimal',
  },
  {
    id: 'vue-router.full',
    dir: 'vue-router-full',
    framework: 'vue',
    packageName: '@tanstack/vue-router',
    case: 'full',
  },
  {
    id: 'react-start.minimal',
    dir: 'react-start-minimal',
    framework: 'react',
    packageName: '@tanstack/react-start',
    case: 'minimal',
  },
  {
    id: 'react-start.deferred-hydration',
    dir: 'react-start-deferred-hydration',
    framework: 'react',
    packageName: '@tanstack/react-start',
    case: 'deferred-hydration',
  },
  {
    id: 'react-start.full',
    dir: 'react-start-full',
    framework: 'react',
    packageName: '@tanstack/react-start',
    case: 'full',
  },
  {
    id: 'react-start.rsbuild.minimal',
    dir: 'react-start-minimal',
    outDir: 'react-start-rsbuild-minimal',
    toolchain: 'rsbuild',
    framework: 'react',
    packageName: '@tanstack/react-start',
    case: 'minimal',
  },
  {
    id: 'react-start.rsbuild.minimal-iife',
    dir: 'react-start-minimal',
    outDir: 'react-start-rsbuild-minimal-iife',
    toolchain: 'rsbuild',
    rsbuildClientOutput: 'iife',
    framework: 'react',
    packageName: '@tanstack/react-start',
    case: 'minimal-iife',
  },
  {
    id: 'react-start.rsbuild.full',
    dir: 'react-start-full',
    outDir: 'react-start-rsbuild-full',
    toolchain: 'rsbuild',
    framework: 'react',
    packageName: '@tanstack/react-start',
    case: 'full',
  },
  {
    id: 'solid-start.minimal',
    dir: 'solid-start-minimal',
    framework: 'solid',
    packageName: '@tanstack/solid-start',
    case: 'minimal',
  },
  {
    id: 'solid-start.deferred-hydration',
    dir: 'solid-start-deferred-hydration',
    framework: 'solid',
    packageName: '@tanstack/solid-start',
    case: 'deferred-hydration',
  },
  {
    id: 'solid-start.full',
    dir: 'solid-start-full',
    framework: 'solid',
    packageName: '@tanstack/solid-start',
    case: 'full',
  },
  {
    id: 'vue-start.minimal',
    dir: 'vue-start-minimal',
    framework: 'vue',
    packageName: '@tanstack/vue-start',
    case: 'minimal',
  },
  {
    id: 'vue-start.full',
    dir: 'vue-start-full',
    framework: 'vue',
    packageName: '@tanstack/vue-start',
    case: 'full',
  },
]

function parseArgs(argv) {
  const { values } = parseNodeArgs({
    args: argv,
    allowPositionals: false,
    strict: true,
    options: {
      sha: { type: 'string' },
      'measured-at': { type: 'string' },
      'append-history': { type: 'string' },
      'results-dir': { type: 'string' },
      'dist-dir': { type: 'string' },
      scenario: { type: 'string' },
      analysis: { type: 'boolean' },
      sourcemap: { type: 'boolean' },
      'skip-package-builds': { type: 'boolean' },
    },
  })

  return {
    sha: values.sha,
    measuredAt: values['measured-at'],
    appendHistory: values['append-history'],
    resultsDir: values['results-dir'],
    distDir: values['dist-dir'],
    scenario: values.scenario,
    analysis: values.analysis === true,
    sourcemap: values.sourcemap === true,
    skipPackageBuilds: values['skip-package-builds'] === true,
  }
}

function filterScenarios(filter) {
  if (!filter) {
    return SCENARIOS
  }

  const requested = filter
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const scenarios = SCENARIOS.filter((scenario) => {
    return requested.some(
      (value) =>
        value === scenario.id ||
        value === scenario.dir ||
        value === scenario.outDir ||
        value === `${scenario.framework}-${scenario.case}`,
    )
  })

  const missing = requested.filter(
    (value) =>
      !SCENARIOS.some(
        (scenario) =>
          value === scenario.id ||
          value === scenario.dir ||
          value === scenario.outDir ||
          value === `${scenario.framework}-${scenario.case}`,
      ),
  )

  if (missing.length > 0) {
    throw new Error(
      `Unknown bundle-size scenario: ${missing.join(', ')}\nKnown scenarios: ${SCENARIOS.map((scenario) => scenario.id).join(', ')}`,
    )
  }

  return scenarios
}

function toIsoDate(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${value}`)
  }

  return date.toISOString()
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function parseMaybeDataJs(raw) {
  const trimmed = raw.trim()

  if (trimmed.startsWith('window.BENCHMARK_DATA')) {
    const sandbox = { window: {} }
    vm.runInNewContext(trimmed, sandbox, { timeout: 1000 })
    return sandbox.window.BENCHMARK_DATA
  }

  return JSON.parse(trimmed)
}

function resolveManifestChunkKey(manifest, keyOrFile) {
  if (manifest[keyOrFile]) {
    return keyOrFile
  }

  for (const [key, value] of Object.entries(manifest)) {
    if (value?.file === keyOrFile) {
      return key
    }
  }

  return undefined
}

function isJsFile(file) {
  return file.endsWith('.js') || file.endsWith('.mjs')
}

function collectInitialJsFiles(manifest, entryKey) {
  const visitedKeys = new Set()
  const files = new Set()

  function visitByKey(chunkKey) {
    if (!chunkKey || visitedKeys.has(chunkKey)) {
      return
    }

    visitedKeys.add(chunkKey)
    const chunk = manifest[chunkKey]

    if (!chunk) {
      return
    }

    if (typeof chunk.file === 'string' && isJsFile(chunk.file)) {
      files.add(chunk.file)
    }

    for (const imported of chunk.imports || []) {
      const resolvedKey = resolveManifestChunkKey(manifest, imported)
      if (resolvedKey) {
        visitByKey(resolvedKey)
      }
    }
  }

  visitByKey(entryKey)

  return [...files].sort()
}

function collectAllViteJsFiles(manifest) {
  const files = new Set()

  for (const chunk of Object.values(manifest)) {
    if (typeof chunk?.file === 'string' && isJsFile(chunk.file)) {
      files.add(chunk.file)
    }
  }

  return [...files].sort()
}

function sizesForFiles(baseDir, fileList) {
  let rawBytes = 0
  let gzipBytes = 0
  let brotliBytes = 0
  const files = []

  for (const relativeFile of fileList) {
    const fullPath = path.join(baseDir, relativeFile)
    const content = fs.readFileSync(fullPath)
    const rawByteLength = content.byteLength
    const gzipByteLength = gzipSync(content).byteLength
    const brotliByteLength = brotliCompressSync(content).byteLength

    rawBytes += rawByteLength
    gzipBytes += gzipByteLength
    brotliBytes += brotliByteLength
    files.push({
      file: relativeFile,
      rawBytes: rawByteLength,
      gzipBytes: gzipByteLength,
      brotliBytes: brotliByteLength,
    })
  }

  return {
    rawBytes,
    gzipBytes,
    brotliBytes,
    files,
  }
}

async function findManifestFiles(rootDir) {
  const manifestPaths = []

  async function visit(currentDir) {
    const entries = await fsp.readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        await visit(fullPath)
        continue
      }

      if (entry.isFile() && entry.name === 'manifest.json') {
        const parent = path.basename(path.dirname(fullPath))
        if (parent === '.vite') {
          manifestPaths.push(fullPath)
        }
      }
    }
  }

  await visit(rootDir)
  return manifestPaths
}

function rankManifestPath(manifestPath) {
  let score = 0

  if (manifestPath.includes(`${path.sep}client${path.sep}`)) {
    score += 100
  }

  if (manifestPath.includes(`${path.sep}server${path.sep}`)) {
    score -= 100
  }

  return score
}

function pickManifestEntryKey(manifest) {
  const entries = Object.entries(manifest)

  const htmlEntry = entries.find(
    ([key, value]) => key.endsWith('.html') && value?.isEntry,
  )
  if (htmlEntry) {
    return htmlEntry[0]
  }

  const jsEntries = entries.filter(
    ([, value]) =>
      value?.isEntry &&
      typeof value.file === 'string' &&
      value.file.endsWith('.js'),
  )

  const preferredPatterns = [
    /virtual:tanstack-start-client-entry/i,
    /src[\\/]main\./i,
    /src[\\/]client\./i,
    /client/i,
  ]

  for (const pattern of preferredPatterns) {
    const preferred = jsEntries.find(
      ([key, value]) => pattern.test(key) || pattern.test(value.file),
    )

    if (preferred) {
      return preferred[0]
    }
  }

  if (jsEntries.length > 0) {
    return jsEntries[0][0]
  }

  const anyEntry = entries.find(([, value]) => value?.isEntry)
  if (anyEntry) {
    return anyEntry[0]
  }

  return undefined
}

async function resolveManifestAndEntry(outDir, scenarioId) {
  const manifestPaths = await findManifestFiles(outDir)

  if (manifestPaths.length === 0) {
    throw new Error(`No Vite manifest files found for scenario: ${scenarioId}`)
  }

  manifestPaths.sort((a, b) => {
    const scoreDiff = rankManifestPath(b) - rankManifestPath(a)
    if (scoreDiff !== 0) {
      return scoreDiff
    }

    return a.length - b.length
  })

  for (const manifestPath of manifestPaths) {
    const manifest = readJson(manifestPath)
    const entryKey = pickManifestEntryKey(manifest)

    if (!entryKey) {
      continue
    }

    const manifestOutDir = path.dirname(path.dirname(manifestPath))

    return {
      manifest,
      entryKey,
      manifestPath,
      manifestOutDir,
    }
  }

  throw new Error(
    `Could not determine manifest entry for scenario: ${scenarioId}`,
  )
}

async function importFromRoot(root, specifier) {
  const requireFromRoot = createRequire(
    path.join(root, 'bundle-size.config.cjs'),
  )
  return import(pathToFileURL(requireFromRoot.resolve(specifier)).href)
}

function getGitStatus() {
  try {
    return {
      branch: execSync('git branch --show-current', {
        encoding: 'utf8',
      }).trim(),
      dirty:
        execSync('git status --porcelain', { encoding: 'utf8' }).trim().length >
        0,
    }
  } catch {
    return {
      branch: '',
      dirty: undefined,
    }
  }
}

function getPackageBuildProjects(scenarios) {
  const projects = new Set()

  for (const scenario of scenarios) {
    projects.add(scenario.packageName)

    if (scenario.packageName.endsWith('-router')) {
      projects.add('@tanstack/router-plugin')
    }
  }

  return [...projects].sort()
}

function buildRequiredPackages({ repoRoot, scenarios, skipPackageBuilds }) {
  const projects = getPackageBuildProjects(scenarios)

  if (skipPackageBuilds || projects.length === 0) {
    return projects
  }

  process.stdout.write(
    `Building package projects for bundle-size scenarios: ${projects.join(', ')}\n`,
  )

  const args = [
    'nx',
    'run-many',
    '--target=build',
    `--projects=${projects.join(',')}`,
    '--outputStyle=stream',
    '--skipRemoteCache',
  ]

  if (
    process.env.NX_SKIP_NX_CACHE === 'true' ||
    process.env.NX_DISABLE_NX_CACHE === 'true'
  ) {
    args.push('--skipNxCache')
  }

  execFileSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  })

  return projects
}

async function buildViteScenario({ root, outDir, sourcemap }) {
  const configFile = path.join(root, 'vite.config.ts')

  await build({
    root,
    configFile,
    logLevel: 'silent',
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    build: {
      outDir,
      emptyOutDir: true,
      target: 'es2022',
      minify: 'esbuild',
      sourcemap: sourcemap ? 'hidden' : false,
      reportCompressedSize: false,
      manifest: true,
    },
  })
}

async function buildRsbuildScenario({ root, outDir, scenario, sourcemap }) {
  const configFile = path.join(root, 'rsbuild.config.ts')
  const { createRsbuild, loadConfig } = await importFromRoot(
    root,
    '@rsbuild/core',
  )
  const previousOutDir = process.env.BUNDLE_SIZE_DIST_DIR
  const previousClientOutput = process.env.BUNDLE_SIZE_RSB_CLIENT_OUTPUT

  process.env.BUNDLE_SIZE_DIST_DIR = outDir
  if (scenario.rsbuildClientOutput) {
    process.env.BUNDLE_SIZE_RSB_CLIENT_OUTPUT = scenario.rsbuildClientOutput
  } else {
    delete process.env.BUNDLE_SIZE_RSB_CLIENT_OUTPUT
  }

  try {
    const { content } = await loadConfig({
      cwd: root,
      path: configFile,
      envMode: 'production',
    })
    const rsbuild = await createRsbuild({
      cwd: root,
      callerName: 'bundle-size-benchmark',
      config: sourcemap
        ? {
            ...content,
            output: {
              ...content.output,
              sourceMap: {
                js: 'source-map',
              },
            },
          }
        : content,
    })
    const result = await rsbuild.build()
    await result.close()
  } finally {
    if (previousOutDir === undefined) {
      delete process.env.BUNDLE_SIZE_DIST_DIR
    } else {
      process.env.BUNDLE_SIZE_DIST_DIR = previousOutDir
    }
    if (previousClientOutput === undefined) {
      delete process.env.BUNDLE_SIZE_RSB_CLIENT_OUTPUT
    } else {
      process.env.BUNDLE_SIZE_RSB_CLIENT_OUTPUT = previousClientOutput
    }
  }
}

async function buildScenario({ root, outDir, scenario, sourcemap }) {
  const previousCwd = process.cwd()
  process.chdir(root)

  try {
    if (scenario.toolchain === 'rsbuild') {
      await buildRsbuildScenario({ root, outDir, scenario, sourcemap })
      return
    }

    await buildViteScenario({ root, outDir, sourcemap })
  } finally {
    process.chdir(previousCwd)
  }
}

async function resolveRsbuildManifest(outDir, scenarioId) {
  const manifestPath = path.join(outDir, 'client', 'manifest.json')

  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `No Rsbuild manifest file found for scenario: ${scenarioId}`,
    )
  }

  const manifest = readJson(manifestPath)
  const entryName = manifest.entries?.index
    ? 'index'
    : Object.keys(manifest.entries || {})[0]

  if (!entryName) {
    throw new Error(
      `Could not determine Rsbuild manifest entry for scenario: ${scenarioId}`,
    )
  }

  return {
    manifest,
    entryKey: entryName,
    manifestPath,
    manifestOutDir: path.dirname(manifestPath),
  }
}

function collectRsbuildInitialJsFiles(manifest, entryKey) {
  const files = manifest.entries?.[entryKey]?.initial?.js

  if (!Array.isArray(files)) {
    return []
  }

  return files
    .filter((file) => typeof file === 'string' && isJsFile(file))
    .sort()
}

function collectRsbuildAllJsFiles(manifest) {
  const files = new Set()

  for (const file of manifest.allFiles || []) {
    if (typeof file === 'string' && isJsFile(file)) {
      files.add(file)
    }
  }

  if (files.size === 0) {
    for (const entry of Object.values(manifest.entries || {})) {
      for (const file of entry?.initial?.js || []) {
        if (typeof file === 'string' && isJsFile(file)) {
          files.add(file)
        }
      }
      for (const file of entry?.async?.js || []) {
        if (typeof file === 'string' && isJsFile(file)) {
          files.add(file)
        }
      }
    }
  }

  return [...files].sort()
}

function decodeVlq(segment) {
  const values = []
  let value = 0
  let shift = 0

  for (const char of segment) {
    let digit =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(
        char,
      )

    if (digit < 0) {
      continue
    }

    const continuation = digit & 32
    digit &= 31
    value += digit << shift

    if (continuation) {
      shift += 5
      continue
    }

    const negative = value & 1
    value >>= 1
    values.push(negative ? -value : value)
    value = 0
    shift = 0
  }

  return values
}

function estimateSourceBytesFromMap(mapPath, generatedPath) {
  if (!fs.existsSync(mapPath)) {
    return []
  }

  const map = readJson(mapPath)
  const sources = map.sources || []
  const sourceBytes = new Map()
  let sourceIndex = 0
  const generatedLines = fs.existsSync(generatedPath)
    ? fs.readFileSync(generatedPath, 'utf8').split('\n')
    : []
  let lineIndex = 0

  for (const line of String(map.mappings || '').split(';')) {
    let generatedColumn = 0
    let previousColumn = 0
    let previousSource = -1
    const segments = line.split(',').filter(Boolean)
    const decodedSegments = []

    for (const segment of segments) {
      const values = decodeVlq(segment)
      generatedColumn += values[0] || 0

      if (values.length >= 4) {
        sourceIndex += values[1] || 0
        decodedSegments.push({ column: generatedColumn, sourceIndex })
      }
    }

    for (const segment of decodedSegments) {
      if (previousSource >= 0) {
        const bytes = Math.max(0, segment.column - previousColumn)
        sourceBytes.set(
          sources[previousSource],
          (sourceBytes.get(sources[previousSource]) || 0) + bytes,
        )
      }

      previousColumn = segment.column
      previousSource = segment.sourceIndex
    }

    if (previousSource >= 0) {
      const bytes = Math.max(
        1,
        (generatedLines[lineIndex]?.length || previousColumn) - previousColumn,
      )
      sourceBytes.set(
        sources[previousSource],
        (sourceBytes.get(sources[previousSource]) || 0) + bytes,
      )
    }

    lineIndex++
  }

  return [...sourceBytes]
    .map(([source, estimatedBytes]) => ({ source, estimatedBytes }))
    .sort((a, b) => b.estimatedBytes - a.estimatedBytes)
}

function sourceAttributionForFiles(baseDir, fileList) {
  return fileList.map((file) => {
    return {
      file,
      sources: estimateSourceBytesFromMap(
        path.join(baseDir, `${file}.map`),
        path.join(baseDir, file),
      ),
    }
  })
}

async function resolveBundleFiles({ outDir, scenario }) {
  if (scenario.toolchain === 'rsbuild') {
    const manifestInfo = await resolveRsbuildManifest(outDir, scenario.id)
    const initialJsFiles = collectRsbuildInitialJsFiles(
      manifestInfo.manifest,
      manifestInfo.entryKey,
    )
    const jsFiles = collectRsbuildAllJsFiles(manifestInfo.manifest)

    return {
      ...manifestInfo,
      initialJsFiles,
      jsFiles,
    }
  }

  const manifestInfo = await resolveManifestAndEntry(outDir, scenario.id)
  const initialJsFiles = collectInitialJsFiles(
    manifestInfo.manifest,
    manifestInfo.entryKey,
  )
  const jsFiles = collectAllViteJsFiles(manifestInfo.manifest)

  return {
    ...manifestInfo,
    initialJsFiles,
    jsFiles,
  }
}

function getCurrentSha(providedSha) {
  if (providedSha) {
    return providedSha
  }

  if (process.env.GITHUB_SHA) {
    return process.env.GITHUB_SHA
  }

  return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
}

function buildCommitUrl(sha) {
  const repo = process.env.GITHUB_REPOSITORY

  if (!repo) {
    return ''
  }

  return `https://github.com/${repo}/commit/${sha}`
}

async function appendHistoryFile({ historyPath, measuredAtIso, sha, benches }) {
  const measuredAtMs = Date.parse(measuredAtIso)
  let writeAsDataJs = historyPath.endsWith('.js')

  let history = {
    lastUpdate: measuredAtMs,
    entries: {},
  }

  if (fs.existsSync(historyPath)) {
    const raw = await fsp.readFile(historyPath, 'utf8')
    writeAsDataJs = raw.trim().startsWith('window.BENCHMARK_DATA')
    history = parseMaybeDataJs(raw)
    history.entries ||= {}
  }

  const entry = {
    commit: {
      id: sha,
      message: `bundle-size snapshot ${sha.slice(0, 12)}`,
      timestamp: measuredAtIso,
      url: buildCommitUrl(sha),
    },
    date: measuredAtMs,
    tool: 'customSmallerIsBetter',
    benches,
  }

  const group = history.entries[BENCHMARK_NAME] || []
  group.push(entry)
  history.entries[BENCHMARK_NAME] = group
  history.lastUpdate = measuredAtMs

  await fsp.mkdir(path.dirname(historyPath), { recursive: true })
  const serialized = JSON.stringify(history, null, 2)
  const output = writeAsDataJs
    ? `window.BENCHMARK_DATA = ${serialized};\n`
    : `${serialized}\n`
  await fsp.writeFile(historyPath, output, 'utf8')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const repoRoot = path.resolve(scriptDir, '../../../')
  const scenariosRoot = path.join(repoRoot, 'benchmarks/bundle-size/scenarios')
  const resultsDir = args.resultsDir
    ? path.resolve(args.resultsDir)
    : path.join(repoRoot, 'benchmarks/bundle-size/results')
  const distDir = args.distDir
    ? path.resolve(args.distDir)
    : path.join(repoRoot, 'benchmarks/bundle-size/dist')

  const measuredAtIso = args.measuredAt
    ? toIsoDate(args.measuredAt)
    : new Date().toISOString()
  const sha = getCurrentSha(args.sha)
  const startedAt = Date.now()
  const scenarios = filterScenarios(args.scenario)
  const packageBuildProjects = buildRequiredPackages({
    repoRoot,
    scenarios,
    skipPackageBuilds: args.skipPackageBuilds,
  })

  await fsp.mkdir(resultsDir, { recursive: true })
  await fsp.mkdir(distDir, { recursive: true })

  const metrics = []

  for (const scenario of scenarios) {
    const root = path.join(scenariosRoot, scenario.dir)
    const outDir = path.join(distDir, scenario.outDir || scenario.dir)

    await buildScenario({
      root,
      outDir,
      scenario,
      sourcemap: args.sourcemap || args.analysis,
    })

    const bundleInfo = await resolveBundleFiles({ outDir, scenario })
    const sizes = sizesForFiles(bundleInfo.manifestOutDir, bundleInfo.jsFiles)
    const initialSizes = sizesForFiles(
      bundleInfo.manifestOutDir,
      bundleInfo.initialJsFiles,
    )
    const initialFileSet = new Set(bundleInfo.initialJsFiles)
    const files = sizes.files.map((file) => ({
      ...file,
      initial: initialFileSet.has(file.file),
    }))
    const metric = {
      id: scenario.id,
      scenarioDir: scenario.dir,
      outDir: scenario.outDir || scenario.dir,
      toolchain: scenario.toolchain || 'vite',
      framework: scenario.framework,
      packageName: scenario.packageName,
      case: scenario.case,
      entryKey: bundleInfo.entryKey,
      manifestPath: path.relative(outDir, bundleInfo.manifestPath),
      manifestOutDir: path.relative(repoRoot, bundleInfo.manifestOutDir),
      initialJsFiles: bundleInfo.initialJsFiles,
      jsFiles: bundleInfo.jsFiles,
      files,
      initialRawBytes: initialSizes.rawBytes,
      initialGzipBytes: initialSizes.gzipBytes,
      initialBrotliBytes: initialSizes.brotliBytes,
      rawBytes: sizes.rawBytes,
      gzipBytes: sizes.gzipBytes,
      brotliBytes: sizes.brotliBytes,
    }

    if (args.analysis) {
      metric.sources = sourceAttributionForFiles(
        bundleInfo.manifestOutDir,
        bundleInfo.jsFiles,
      )
    }

    metrics.push(metric)
  }
  const completedAt = Date.now()

  const current = {
    schemaVersion: 1,
    benchmarkName: BENCHMARK_NAME,
    measuredAt: measuredAtIso,
    generatedAt: new Date().toISOString(),
    sha,
    status: {
      state: 'success',
      command: `node ${path.relative(repoRoot, fileURLToPath(import.meta.url))}${args.scenario ? ` --scenario ${args.scenario}` : ''}${args.analysis ? ' --analysis' : ''}${args.sourcemap ? ' --sourcemap' : ''}${args.skipPackageBuilds ? ' --skip-package-builds' : ''}`,
      scenarioFilter: args.scenario || null,
      measuredScenarios: scenarios.map((scenario) => scenario.id),
      packageBuildProjects,
      skipPackageBuilds: args.skipPackageBuilds,
      durationMs: completedAt - startedAt,
      git: {
        sha,
        ...getGitStatus(),
      },
    },
    metrics,
  }

  const benchmarkActionRows = metrics.map((metric) => ({
    name: metric.id,
    unit: 'bytes',
    value: metric.gzipBytes,
    extra: `raw=${metric.rawBytes}; brotli=${metric.brotliBytes}; initial_gzip=${metric.initialGzipBytes}`,
  }))

  const currentPath = path.join(resultsDir, 'current.json')
  const benchmarkActionPath = path.join(resultsDir, 'benchmark-action.json')

  await fsp.writeFile(
    currentPath,
    JSON.stringify(current, null, 2) + '\n',
    'utf8',
  )
  await fsp.writeFile(
    benchmarkActionPath,
    JSON.stringify(benchmarkActionRows, null, 2) + '\n',
    'utf8',
  )

  if (args.appendHistory) {
    await appendHistoryFile({
      historyPath: path.resolve(args.appendHistory),
      measuredAtIso,
      sha,
      benches: benchmarkActionRows,
    })
  }

  process.stdout.write(
    `Measured ${metrics.length} scenarios. Wrote ${path.relative(repoRoot, currentPath)} and ${path.relative(repoRoot, benchmarkActionPath)}\n`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
