import { makeLevelData } from '../loaders/shared-data'
import { randomSegment, runRequestLoop } from '../../bench-utils'
import type { StartRequestHandler } from '../../bench-utils'

export type { StartRequestHandler }

const benchmarkSeed = 0xdecafbad
const selectiveLoopIterations = 20

const requestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

function buildSelectiveRequest(random: () => number) {
  const a = randomSegment(random)
  const b = randomSegment(random)
  const c = randomSegment(random)

  return new Request(`http://localhost/mix/${a}/${b}/${c}`, requestInit)
}

export async function assertSelectiveSanity(handler: StartRequestHandler) {
  const a = 'a-sanity'
  const b = 'b-sanity'
  const c = 'c-sanity'
  const response = await handler.fetch(
    new Request(`http://localhost/mix/${a}/${b}/${c}`, requestInit),
  )
  const body = await response.text()
  const levelARenderedMarker = `level-a-rendered-${a}`
  const levelALoaderMarker = makeLevelData(`level-a-loader-${a}`, 1).items[0]
    ?.name
  const dataOnlyRenderedMarker = `data-only-rendered-${b}`
  const levelBLoaderMarker = `level-b-loader-${b}`
  const csrRenderedMarker = `csr-rendered-${c}`
  const levelCLoaderMarker = `level-c-loader-${c}`

  if (response.status !== 200) {
    throw new Error(
      `Expected setup request status 200, received ${response.status}`,
    )
  }

  if (!body.includes(levelARenderedMarker)) {
    throw new Error(
      'Expected setup response to include level-a rendered content',
    )
  }

  if (!levelALoaderMarker || !body.includes(levelALoaderMarker)) {
    throw new Error('Expected setup response to include level-a loader content')
  }

  if (body.includes(dataOnlyRenderedMarker)) {
    throw new Error(
      'Expected data-only route component to be absent from SSR HTML',
    )
  }

  const hydrationIndex = body.indexOf('$_TSR')

  if (hydrationIndex === -1) {
    throw new Error('Expected setup response to include the dehydration marker')
  }

  if (!body.slice(hydrationIndex).includes(levelBLoaderMarker)) {
    throw new Error('Expected level-b loader marker in the dehydration payload')
  }

  if (body.includes(csrRenderedMarker)) {
    throw new Error('Expected csr route component to be absent from SSR HTML')
  }

  if (body.includes(levelCLoaderMarker)) {
    throw new Error('Expected level-c loader marker to be absent from SSR HTML')
  }
}

export const benchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}

export function runSelectiveLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: selectiveLoopIterations,
    buildRequest: buildSelectiveRequest,
  })
}
