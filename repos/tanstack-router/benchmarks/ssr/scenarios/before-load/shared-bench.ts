import { makeBeforeLoadMarker } from './shared'
import { randomSegment, runRequestLoop } from '../../bench-utils'
import type { StartRequestHandler } from '../../bench-utils'

export type { StartRequestHandler }

const benchmarkSeed = 0xdecafbad
const beforeLoadLoopIterations = 30

const requestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

function buildBeforeLoadRequest(random: () => number, index: number) {
  const suffix = index.toString(36)
  const a = `${randomSegment(random)}-${suffix}`
  const b = `${randomSegment(random)}-${suffix}`
  const c = `${randomSegment(random)}-${suffix}`

  return new Request(`http://localhost/${a}/${b}/${c}`, requestInit)
}

export async function assertBeforeLoadScenario(handler: StartRequestHandler) {
  const response = await handler.fetch(
    new Request('http://localhost/a-sanity/b-sanity/c-sanity', requestInit),
  )
  const body = await response.text()
  const expectedMarker = makeBeforeLoadMarker({
    ctxA: 'a-sanity',
    ctxB: 'b-sanity',
    ctxC: 'c-sanity',
    chainToken: 'a-sanity.b-sanity.c-sanity',
  })

  if (response.status !== 200) {
    throw new Error(
      `Expected beforeLoad setup status 200, received ${response.status}`,
    )
  }

  if (!body.includes(expectedMarker)) {
    throw new Error(
      `Expected beforeLoad setup response to include ${expectedMarker}`,
    )
  }
}

export const beforeLoadBenchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}

export function runBeforeLoadLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: beforeLoadLoopIterations,
    buildRequest: buildBeforeLoadRequest,
  })
}
