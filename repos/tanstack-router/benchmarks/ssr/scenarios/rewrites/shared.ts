import { expect } from 'vitest'
import { randomSegment, runRequestLoop } from '../../bench-utils'
import type { StartRequestHandler } from '../../bench-utils'

export type { StartRequestHandler }

const benchmarkSeed = 0xdecafbad
const origin = 'http://localhost'
const localizedLoopIterations = 25
const passthroughLoopIterations = 25

const requestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

export const rewriteBenchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}

function buildLocalizedRequest(random: () => number) {
  return new Request(
    `${origin}/app/fr/p/${randomSegment(random)}/${randomSegment(random)}`,
    requestInit,
  )
}

function buildPassthroughRequest(random: () => number) {
  return new Request(
    `${origin}/app/p/${randomSegment(random)}/${randomSegment(random)}`,
    requestInit,
  )
}

export function runRewriteLocalizedLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: localizedLoopIterations,
    buildRequest: buildLocalizedRequest,
  })
}

export function runRewritePassthroughLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: passthroughLoopIterations,
    buildRequest: buildPassthroughRequest,
  })
}

export async function assertRewriteScenario(handler: StartRequestHandler) {
  const localizedResponse = await handler.fetch(
    new Request(`${origin}/app/fr/p/sanity-a/sanity-b`, requestInit),
  )
  const localizedBody = await localizedResponse.text()

  expect(localizedResponse.status).toBe(200)
  expect(localizedBody).toContain('rewrite-leaf')
  expect(localizedBody).toContain('sanity-a')
  expect(localizedBody).toContain('sanity-b')
  expect(localizedBody).toContain('href="/app/fr/p/sanity-a/sanity-b"')
  expect(localizedBody).toContain('href="/app/fr/p/sanity-a/next-sanity-b"')

  const passthroughResponse = await handler.fetch(
    new Request(`${origin}/app/p/sanity-a/sanity-b`, requestInit),
  )
  const passthroughBody = await passthroughResponse.text()

  expect(passthroughResponse.status).toBe(200)
  expect(passthroughBody).toContain('rewrite-leaf')
  expect(passthroughBody).toContain('sanity-a')
  expect(passthroughBody).toContain('sanity-b')
  expect(passthroughBody).toContain('href="/app/fr/p/sanity-a/sanity-b"')
  expect(passthroughBody).toContain('href="/app/fr/p/sanity-a/next-sanity-b"')

  const unprefixedResponse = await handler.fetch(
    new Request(`${origin}/p/sanity-a/sanity-b`, requestInit),
  )
  await unprefixedResponse.text()

  expect(unprefixedResponse.status).toBe(307)
  expect(unprefixedResponse.headers.get('location')).toBe(
    '/app/p/sanity-a/sanity-b',
  )
}
