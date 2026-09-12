import { makeLevelData } from './shared-data'
import { randomSegment, runRequestLoop } from '../../bench-utils'
import type { StartRequestHandler } from '../../bench-utils'

export type { StartRequestHandler }

const benchmarkSeed = 0xdecafbad
const loadersLoopIterations = 15

const requestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

function buildLoaderRequest(random: () => number, index: number) {
  const suffix = index.toString(36)
  const a = `${randomSegment(random)}-${suffix}`
  const b = `${randomSegment(random)}-${suffix}`
  const c = `${randomSegment(random)}-${suffix}`
  const page = Math.floor(random() * 10)
  const tags = JSON.stringify([
    `t-${randomSegment(random)}-${suffix}`,
    `t-${randomSegment(random)}-${suffix}`,
  ])

  return new Request(
    `http://localhost/${a}/${b}/${c}?page=${page}&tags=${encodeURIComponent(tags)}`,
    requestInit,
  )
}

export async function assertLoadersSanity(handler: StartRequestHandler) {
  const page = 3
  const leafSource = 'c-sanity'
  const tags = JSON.stringify(['t-x', 't-y'])
  const response = await handler.fetch(
    new Request(
      `http://localhost/a-sanity/b-sanity/${leafSource}?page=${page}&tags=${encodeURIComponent(tags)}`,
      requestInit,
    ),
  )
  const body = await response.text()
  const leafMarker = makeLevelData(leafSource, page).items[0]?.name

  if (response.status !== 200) {
    throw new Error(
      `Expected setup request status 200, received ${response.status}`,
    )
  }

  if (!leafMarker || !body.includes(leafMarker)) {
    throw new Error('Expected setup response to include the leaf loader item')
  }

  if (!body.includes('$_TSR')) {
    throw new Error('Expected setup response to include the dehydration marker')
  }
}

export const benchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}

export function runLoadersLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: loadersLoopIterations,
    buildRequest: buildLoaderRequest,
  })
}
