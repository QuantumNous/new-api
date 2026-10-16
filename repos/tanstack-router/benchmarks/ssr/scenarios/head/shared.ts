import { expect } from 'vitest'
import { randomSegment, runRequestLoop } from '../../bench-utils'
import type { StartRequestHandler } from '../../bench-utils'

export type { StartRequestHandler }

const benchmarkSeed = 0xdecafbad
const origin = 'http://localhost'
const dedupedMetaName = 'head-benchmark-shared'
const headLoopIterations = 25

const requestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

export const headBenchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}

function buildHeadRequest(random: () => number) {
  return new Request(
    `${origin}/h/${randomSegment(random)}/${randomSegment(random)}/${randomSegment(random)}`,
    requestInit,
  )
}

export function runHeadLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: headLoopIterations,
    buildRequest: buildHeadRequest,
  })
}

export async function assertHeadSanity(handler: StartRequestHandler) {
  const a = 'sanity-a'
  const b = 'sanity-b'
  const c = 'sanity-c'
  const response = await handler.fetch(
    new Request(`${origin}/h/${a}/${b}/${c}`, requestInit),
  )
  const body = await response.text()
  const dedupedMetaCount = body.split(dedupedMetaName).length - 1

  expect(response.status).toBe(200)
  expect(body).toContain(`c-${c}-9`)
  expect(dedupedMetaCount).toBe(1)
  expect(body).toContain(`SSR Head L3 ${a} ${b} ${c}`)
}
