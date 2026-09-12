import { expect } from 'vitest'
import { randomSegment, runRequestLoop } from '../../bench-utils'
import type { StartRequestHandler } from '../../bench-utils'

export type { StartRequestHandler }

const benchmarkSeed = 0xdecafbad
const origin = 'http://localhost'
const cdnOrigin = 'https://cdn.example.com'
const inlineCssLoopIterations = 25
const linkedCssLoopIterations = 30

const inlineRequestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

const linkedRequestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
    'x-inline-css': 'false',
  },
} satisfies RequestInit

export const assetsBenchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}

function buildAssetsRequest(random: () => number, requestInit: RequestInit) {
  return new Request(
    `${origin}/a/${randomSegment(random)}/${randomSegment(random)}`,
    requestInit,
  )
}

export function runAssetsInlineLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: inlineCssLoopIterations,
    buildRequest: (random) => buildAssetsRequest(random, inlineRequestInit),
  })
}

export function runAssetsLinkedControlLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: linkedCssLoopIterations,
    buildRequest: (random) => buildAssetsRequest(random, linkedRequestInit),
  })
}

export async function assertAssetsScenario(handler: StartRequestHandler) {
  const inlineResponse = await handler.fetch(
    new Request(`${origin}/a/sanity-x/sanity-y`, inlineRequestInit),
  )
  const inlineBody = await inlineResponse.text()
  const inlineLinkHeader = inlineResponse.headers.get('link') ?? ''

  expect(inlineResponse.status).toBe(200)
  expect(inlineBody).toContain('SSR Assets sanity-x sanity-y')
  expect(inlineBody).toContain('<style')
  expect(inlineBody).toContain('assets-level-a-css')
  expect(inlineBody).toContain('assets-leaf-css')
  expect(inlineBody).toContain(`${cdnOrigin}/assets/`)
  expect(inlineLinkHeader).toContain(`${cdnOrigin}/assets/`)
  expect(inlineLinkHeader).toContain('/asset-preload/sanity-y-0.png')

  const linkedResponse = await handler.fetch(
    new Request(`${origin}/a/sanity-x/sanity-y`, linkedRequestInit),
  )
  const linkedBody = await linkedResponse.text()
  const linkedLinkHeader = linkedResponse.headers.get('link') ?? ''

  expect(linkedResponse.status).toBe(200)
  expect(linkedBody).toContain('SSR Assets sanity-x sanity-y')
  expect(linkedBody).toContain('rel="stylesheet"')
  expect(linkedBody).not.toContain('<style')
  expect(linkedBody).toContain(`${cdnOrigin}/assets/`)
  expect(linkedLinkHeader).toContain(`${cdnOrigin}/assets/`)
  expect(linkedLinkHeader).toContain('as=style')
}
