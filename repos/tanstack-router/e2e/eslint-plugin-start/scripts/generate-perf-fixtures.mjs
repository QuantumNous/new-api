import * as fs from 'node:fs/promises'
import * as path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '..')
const outDir = path.join(rootDir, 'src', 'perf', 'generated')

// Mode: small (no noise) or huge (5000 noise files)
const modeRaw = process.env.PERF_MODE ?? 'huge'
const mode = modeRaw === 'small' || modeRaw === 'huge' ? modeRaw : 'huge'

// Violation mode: 'none' | 'async' | 'server' | 'both'
const violationMode = process.env.PERF_VIOLATION ?? 'none'

// Noise complexity: 'simple' (1 line) or 'complex' (classes, interfaces, functions)
const noiseComplexity = process.env.PERF_NOISE_COMPLEXITY ?? 'simple'

// Number of entry points (route files + server component files)
const numEntries = Number.parseInt(process.env.PERF_ENTRIES ?? '1', 10)

const noiseFilesHuge = Number.parseInt(
  process.env.PERF_NOISE_FILES ?? '5000',
  10,
)
const chainDepthHuge = Number.parseInt(process.env.PERF_CHAIN_DEPTH ?? '50', 10)

const presets = {
  small: {
    noiseFiles: 0,
    chainDepth: 50,
  },
  huge: {
    noiseFiles: noiseFilesHuge,
    chainDepth: chainDepthHuge,
  },
}

async function main() {
  const { noiseFiles, chainDepth } = presets[mode]

  await fs.rm(outDir, { recursive: true, force: true })
  await fs.mkdir(outDir, { recursive: true })

  await writeNoise(outDir, noiseFiles)
  await writeChain(outDir, chainDepth)
  await writeRouteFiles(outDir, numEntries)
  await writeServerComponentFiles(outDir, numEntries)

  const summary = {
    mode,
    violationMode,
    noiseComplexity,
    numEntries,
    noiseFiles,
    chainDepth,
    outDir,
  }

  await fs.writeFile(
    path.join(outDir, 'meta.json'),
    JSON.stringify(summary, null, 2) + '\n',
    'utf8',
  )
}

async function writeNoise(baseDir, count) {
  const noiseDir = path.join(baseDir, 'noise')
  await fs.mkdir(noiseDir, { recursive: true })

  const writes = []
  for (let i = 0; i < count; i++) {
    const id = String(i).padStart(5, '0')
    const file = path.join(noiseDir, `noise-${id}.ts`)
    // No route options, no server roots, no 'use client'
    const contents =
      noiseComplexity === 'complex'
        ? generateComplexNoise(id, i)
        : `export const noise_${id} = ${i} as const\n`
    writes.push(fs.writeFile(file, contents, 'utf8'))
  }
  await Promise.all(writes)
}

/**
 * Generate a complex noise file with ~100 AST nodes:
 * - interfaces, type aliases
 * - class with methods, properties
 * - functions with parameters and return types
 * - nested objects and arrays
 */
function generateComplexNoise(id, num) {
  return `// Complex noise file ${id}
interface NoiseConfig${id} {
  id: number
  name: string
  enabled: boolean
  options: {
    timeout: number
    retries: number
    tags: string[]
  }
}

type NoiseResult${id} = {
  success: boolean
  data: string[]
  metadata: Record<string, unknown>
}

export class NoiseService${id} {
  private config: NoiseConfig${id}
  private cache: Map<string, NoiseResult${id}> = new Map()

  constructor(config: NoiseConfig${id}) {
    this.config = config
  }

  async process(input: string[]): Promise<NoiseResult${id}> {
    const processed = input
      .filter((x) => x.length > 0)
      .map((x) => x.trim().toUpperCase())
      .slice(0, this.config.options.retries)

    return {
      success: true,
      data: processed,
      metadata: { processedAt: Date.now(), count: processed.length },
    }
  }

  getConfig(): NoiseConfig${id} {
    return { ...this.config }
  }

  static create(id: number): NoiseService${id} {
    return new NoiseService${id}({
      id,
      name: \`noise-\${id}\`,
      enabled: true,
      options: { timeout: 5000, retries: 3, tags: ['default', 'auto'] },
    })
  }
}

function helperFn${id}(a: number, b: number): number {
  const result = a + b
  return result * 2
}

const constants${id} = {
  VERSION: '1.0.0',
  MAX_ITEMS: 100,
  DEFAULTS: { enabled: true, timeout: 1000 },
} as const

export const noise_${id} = {
  service: NoiseService${id}.create(${num}),
  helper: helperFn${id},
  constants: constants${id},
}
`
}

async function writeChain(baseDir, depth) {
  const chainDir = path.join(baseDir, 'chain')
  await fs.mkdir(chainDir, { recursive: true })

  // Create a deep JSX render chain so the rule has something to traverse
  for (let i = 0; i < depth; i++) {
    const next = i + 1
    const file = path.join(chainDir, `Comp${i}.tsx`)

    const importNext =
      next < depth ? `import { Comp${next} } from './Comp${next}'\n` : ''
    const body = next < depth ? `<Comp${next} />` : `<div>Leaf</div>`

    const contents = `${importNext}
export function Comp${i}() {
  return ${body}
}
`

    // eslint-disable-next-line no-await-in-loop
    await fs.writeFile(file, contents, 'utf8')
  }

  // AsyncLeaf: async component (violation for no-async-client-component when in client context)
  const asyncFile = path.join(chainDir, 'AsyncLeaf.tsx')
  await fs.writeFile(
    asyncFile,
    `export async function AsyncLeaf() {
  return <div>Async</div>
}
`,
    'utf8',
  )

  // HookLeaf: component with useState (violation for no-client-code-in-server-component)
  const hookFile = path.join(chainDir, 'HookLeaf.tsx')
  await fs.writeFile(
    hookFile,
    `import { useState } from 'react'

export function HookLeaf() {
  const [count, setCount] = useState(0)
  return <div onClick={() => setCount(c => c + 1)}>Count: {count}</div>
}
`,
    'utf8',
  )

  // CleanLeaf: no violations
  const cleanFile = path.join(chainDir, 'CleanLeaf.tsx')
  await fs.writeFile(
    cleanFile,
    `export function CleanLeaf() {
  return <div>Clean</div>
}
`,
    'utf8',
  )
}

/**
 * Generate multiple route files for no-async-client-component benchmarking.
 * - violation='async' or 'both': references AsyncLeaf (causes violation)
 * - otherwise: references Comp0 (no violation)
 */
async function writeRouteFiles(baseDir, count) {
  const routesDir = path.join(baseDir, 'routes')
  await fs.mkdir(routesDir, { recursive: true })

  const hasAsyncViolation =
    violationMode === 'async' || violationMode === 'both'

  const writes = []
  for (let i = 0; i < count; i++) {
    const file = path.join(routesDir, `route-${i}.tsx`)

    let contents
    if (hasAsyncViolation) {
      contents = `import { createFileRoute } from '@tanstack/react-router'
import { AsyncLeaf } from '../chain/AsyncLeaf'

export const Route${i} = createFileRoute(undefined)({
  component: AsyncLeaf,
})
`
    } else {
      contents = `import { createFileRoute } from '@tanstack/react-router'
import { Comp0 } from '../chain/Comp0'

export const Route${i} = createFileRoute(undefined)({
  component: Comp0,
})
`
    }

    writes.push(fs.writeFile(file, contents, 'utf8'))
  }
  await Promise.all(writes)
}

/**
 * Generate multiple server component files for no-client-code-in-server-component benchmarking.
 * - violation='server' or 'both': references HookLeaf (causes violation)
 * - otherwise: references CleanLeaf (no violation)
 */
async function writeServerComponentFiles(baseDir, count) {
  const serverDir = path.join(baseDir, 'server')
  await fs.mkdir(serverDir, { recursive: true })

  const hasServerViolation =
    violationMode === 'server' || violationMode === 'both'

  const writes = []
  for (let i = 0; i < count; i++) {
    const file = path.join(serverDir, `server-${i}.tsx`)

    let contents
    if (hasServerViolation) {
      contents = `import { createCompositeComponent } from '@tanstack/react-start/rsc'
import { HookLeaf } from '../chain/HookLeaf'

export const ServerComp${i} = createCompositeComponent(() => {
  return <HookLeaf />
})
`
    } else {
      contents = `import { createCompositeComponent } from '@tanstack/react-start/rsc'
import { CleanLeaf } from '../chain/CleanLeaf'

export const ServerComp${i} = createCompositeComponent(() => {
  return <CleanLeaf />
})
`
    }

    writes.push(fs.writeFile(file, contents, 'utf8'))
  }
  await Promise.all(writes)
}

await main()
