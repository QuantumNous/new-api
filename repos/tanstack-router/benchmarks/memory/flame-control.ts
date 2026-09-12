import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const flameEnabled = process.env.TSR_MEMORY_FLAME === '1'
const heapIntervalBytes = 512 * 1024
const heapStackDepth = 64

interface HeapProfile {
  encode: () => Uint8Array
}

interface HeapProfiler {
  start: (intervalBytes: number, stackDepth: number) => void
  stop: () => void
  v8Profile: () => unknown
  convertProfile: (
    v8Profile: unknown,
    ignoreSamplePath?: string,
    sourceMapper?: unknown,
  ) => HeapProfile
}

interface SourceMapperConstructor {
  create: (searchDirs: Array<string>) => Promise<unknown>
}

interface PprofModule {
  heap: HeapProfiler
  SourceMapper: SourceMapperConstructor
}

function loadPprof() {
  const requireFrom = process.env.TSR_MEMORY_REQUIRE_FROM
    ? path.resolve(process.env.TSR_MEMORY_REQUIRE_FROM)
    : import.meta.url
  const require = createRequire(requireFrom)

  return require('@datadog/pprof') as PprofModule
}

function getSourcemapDirs() {
  return (process.env.TSR_MEMORY_SOURCEMAP_DIRS ?? '')
    .split(path.delimiter)
    .filter(Boolean)
}

async function createSourceMapper(pprof: PprofModule) {
  const sourcemapDirs = getSourcemapDirs()

  if (sourcemapDirs.length === 0) {
    return undefined
  }

  return pprof.SourceMapper.create(sourcemapDirs)
}

function formatTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function formatProfileFileName(profileName?: string) {
  const profileNameSlug = profileName
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const profileNamePart = profileNameSlug ? `${profileNameSlug}-` : ''

  return `heap-profile-${profileNamePart}${formatTimestamp()}.pb`
}

export async function profileFlameWorkload(
  workload: () => Promise<void> | void,
  profileName?: string,
) {
  if (!flameEnabled) {
    await workload()
    return
  }

  const profileDir = process.env.TSR_MEMORY_PROFILE_DIR

  if (!profileDir) {
    throw new Error('TSR_MEMORY_PROFILE_DIR must be set for flame profiling')
  }

  fs.mkdirSync(profileDir, { recursive: true })

  const pprof = loadPprof()
  const sourceMapper = await createSourceMapper(pprof)

  pprof.heap.start(heapIntervalBytes, heapStackDepth)

  let workloadError: unknown = undefined
  let v8Profile: unknown = undefined

  try {
    await workload()
  } catch (error) {
    workloadError = error
  } finally {
    try {
      v8Profile = pprof.heap.v8Profile()
    } finally {
      pprof.heap.stop()
    }
  }

  const heapProfile = pprof.heap.convertProfile(
    v8Profile,
    undefined,
    sourceMapper,
  )
  const profilePath = path.join(profileDir, formatProfileFileName(profileName))

  fs.writeFileSync(profilePath, heapProfile.encode())
  console.log(`Heap profile written to: ${profilePath}`)

  if (workloadError) {
    throw workloadError
  }
}
