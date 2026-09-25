import { benchPointAdapterKey, richDateIso } from './shared-data'
import { randomSegment, runRequestLoop } from '../../bench-utils'
import type { StartRequestHandler } from '../../bench-utils'

export type { StartRequestHandler }

const benchmarkSeed = 0xdecafbad
const richSerializationLoopIterations = 30
const plainSerializationLoopIterations = 30

const requestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

function buildSerializationRequest(
  route: 'plain' | 'rich',
  random: () => number,
  index: number,
) {
  const suffix = index.toString(36)
  const id = `${randomSegment(random)}-${suffix}`

  return new Request(`http://localhost/${route}/${id}`, requestInit)
}

async function fetchScenarioBody(
  handler: StartRequestHandler,
  route: 'plain' | 'rich',
) {
  const response = await handler.fetch(
    new Request(`http://localhost/${route}/sanity`, requestInit),
  )
  const body = await response.text()

  if (response.status !== 200) {
    throw new Error(
      `Expected ${route} sanity request status 200, received ${response.status}: ${body}`,
    )
  }

  if (!body.includes('$_TSR')) {
    throw new Error(`Expected ${route} response to include dehydration marker`)
  }

  return body
}

function assertIncludes(body: string, marker: string, label: string) {
  if (!body.includes(marker)) {
    throw new Error(`Expected ${label} response to include ${marker}`)
  }
}

function assertExcludes(body: string, marker: string, label: string) {
  if (body.includes(marker)) {
    throw new Error(`Expected ${label} response not to include ${marker}`)
  }
}

export async function assertSerializationScenario(
  handler: StartRequestHandler,
) {
  const richBody = await fetchScenarioBody(handler, 'rich')
  const plainBody = await fetchScenarioBody(handler, 'plain')

  assertIncludes(richBody, 'rich-sanity', 'rich')
  assertIncludes(richBody, benchPointAdapterKey, 'rich')
  assertIncludes(richBody, richDateIso, 'rich')
  assertIncludes(richBody, 'new Date', 'rich')
  assertIncludes(richBody, 'new Map', 'rich')
  assertIncludes(richBody, 'new Error', 'rich')

  assertIncludes(plainBody, 'plain-sanity', 'plain')
  assertExcludes(plainBody, benchPointAdapterKey, 'plain')
  assertExcludes(plainBody, 'new Date', 'plain')
  assertExcludes(plainBody, 'new Map', 'plain')
  assertExcludes(plainBody, 'new Error', 'plain')
}

export const serializationBenchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}

export function runRichSerializationLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: richSerializationLoopIterations,
    buildRequest: (random, index) =>
      buildSerializationRequest('rich', random, index),
  })
}

export function runPlainSerializationLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: plainSerializationLoopIterations,
    buildRequest: (random, index) =>
      buildSerializationRequest('plain', random, index),
  })
}
