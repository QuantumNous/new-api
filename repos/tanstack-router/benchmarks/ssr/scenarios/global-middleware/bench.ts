import { toJSONAsync } from 'seroval'
import {
  createDeterministicRandom,
  randomSegment,
  runRequestLoop,
} from '../../bench-utils'
import {
  expectedFunctionTotal,
  expectedRequestTotal,
  makeDocumentMarker,
  makeServerFnMarker,
  makeServerRouteMarker,
} from './shared'
import type { StartRequestHandler } from '../../bench-utils'

export type { StartRequestHandler }

type Payload = {
  q: string
  n: number
  nested: { list: Array<string> }
}

type FnUrls = {
  post: string
}

export interface GlobalMiddlewareBenchContext {
  urls: FnUrls
  bodies: Array<string>
  expectedFnMarker: string
}

const benchmarkSeed = 0xdecafbad
const origin = 'http://localhost'
const tssContentTypeFramed = 'application/x-tss-framed'
const xTssSerialized = 'x-tss-serialized'
const acceptHeader = `${tssContentTypeFramed}, application/x-ndjson, application/json`
const documentRequestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit
const apiRequestInit = {
  method: 'GET',
  headers: {
    accept: 'application/json',
  },
} satisfies RequestInit
const postHeaders = {
  'x-tsr-serverFn': 'true',
  'sec-fetch-site': 'same-origin',
  accept: acceptHeader,
  'content-type': 'application/json',
} satisfies HeadersInit
const documentLoopIterations = 50
const serverFnLoopIterations = 125
const serverRouteLoopIterations = 250

export const globalMiddlewareBenchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
} as const

function createPayloads() {
  const random = createDeterministicRandom(benchmarkSeed)

  return Array.from({ length: 10 }, (_, index): Payload => {
    const queryParts = Array.from({ length: 6 }, () => randomSegment(random))

    return {
      q: `q-${index}-${queryParts.join('-')}`,
      n: 100 + index,
      nested: {
        list: Array.from(
          { length: 5 },
          () => `l-${index}-${randomSegment(random)}-${randomSegment(random)}`,
        ),
      },
    }
  })
}

async function createBodies(payloads: Array<Payload>) {
  return await Promise.all(
    payloads.map(async (payload) =>
      JSON.stringify(await toJSONAsync({ data: payload })),
    ),
  )
}

async function discoverUrls(handler: StartRequestHandler) {
  const response = await handler.fetch(new Request(`${origin}/api/fn-urls`))

  if (response.status === 404) {
    throw new Error('URL discovery route returned 404 for /api/fn-urls')
  }

  if (response.status !== 200) {
    throw new Error(
      `URL discovery failed with status ${response.status}: ${await response.text()}`,
    )
  }

  const urls = (await response.json()) as Partial<FnUrls>

  if (typeof urls.post !== 'string') {
    throw new Error(
      `URL discovery returned invalid payload: ${JSON.stringify(urls)}`,
    )
  }

  return { post: urls.post }
}

function buildDocumentRequest(random: () => number, index: number) {
  return new Request(
    `${origin}/page/${randomSegment(random)}-${index.toString(36)}`,
    documentRequestInit,
  )
}

function buildServerRouteRequest(random: () => number, index: number) {
  return new Request(
    `${origin}/api/ping/${randomSegment(random)}-${index.toString(36)}`,
    apiRequestInit,
  )
}

function buildPostRequest(urls: FnUrls, bodies: Array<string>, index: number) {
  return new Request(`${origin}${urls.post}`, {
    method: 'POST',
    headers: postHeaders,
    body: bodies[index % bodies.length],
  })
}

export async function setupGlobalMiddlewareBench(
  handler: StartRequestHandler,
): Promise<GlobalMiddlewareBenchContext> {
  const urls = await discoverUrls(handler)
  const payloads = createPayloads()
  const bodies = await createBodies(payloads)
  const expectedFnMarker = makeServerFnMarker(payloads[0]!.q, {
    requestTrace: 'req.r1.r2.r3',
    requestTotal: expectedRequestTotal,
    functionTrace: 'fn.f1.f2',
    functionTotal: expectedFunctionTotal,
  })

  return { urls, bodies, expectedFnMarker }
}

async function assertDocumentResponse(handler: StartRequestHandler) {
  const id = 'page-sanity'
  const response = await handler.fetch(
    new Request(`${origin}/page/${id}`, documentRequestInit),
  )
  const body = await response.text()
  const expectedMarker = makeDocumentMarker(id, {
    requestTrace: 'req.r1.r2.r3',
    requestTotal: expectedRequestTotal,
  })

  if (response.status !== 200) {
    throw new Error(`Expected document status 200, received ${response.status}`)
  }

  if (!body.includes(expectedMarker)) {
    throw new Error(
      `Expected document response to include global middleware marker ${expectedMarker}`,
    )
  }
}

async function assertServerRouteResponse(handler: StartRequestHandler) {
  const id = 'route-sanity'
  const response = await handler.fetch(
    new Request(`${origin}/api/ping/${id}`, apiRequestInit),
  )

  if (response.status !== 200) {
    throw new Error(
      `Expected server route status 200, received ${response.status}`,
    )
  }

  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('application/json')) {
    throw new Error(
      `Expected JSON server route response, received ${contentType}`,
    )
  }

  const body = (await response.json()) as {
    marker?: string
    requestTotal?: number
  }
  const expectedMarker = makeServerRouteMarker(id, {
    requestTrace: 'req.r1.r2.r3',
    requestTotal: expectedRequestTotal,
  })

  if (body.marker !== expectedMarker) {
    throw new Error(
      `Expected server route marker ${expectedMarker}, received ${body.marker}`,
    )
  }

  if (body.requestTotal !== expectedRequestTotal) {
    throw new Error(
      `Expected server route requestTotal ${expectedRequestTotal}, received ${body.requestTotal}`,
    )
  }
}

async function assertServerFnResponse(
  handler: StartRequestHandler,
  context: GlobalMiddlewareBenchContext,
) {
  const response = await handler.fetch(
    buildPostRequest(context.urls, context.bodies, 0),
  )
  const text = await response.text()

  if (response.status === 403) {
    throw new Error('Server function sanity check failed with 403')
  }

  if (response.status === 404) {
    throw new Error('Server function sanity check failed with 404')
  }

  if (response.status !== 200) {
    throw new Error(
      `Server function sanity check failed with status ${response.status}: ${text}`,
    )
  }

  if (!response.headers.get(xTssSerialized)) {
    throw new Error(`Server function response missing ${xTssSerialized} header`)
  }

  if (!text.includes(context.expectedFnMarker)) {
    throw new Error(
      `Expected server function response to include ${context.expectedFnMarker}: ${text}`,
    )
  }
}

export async function assertGlobalMiddlewareScenario(
  handler: StartRequestHandler,
  context: GlobalMiddlewareBenchContext,
) {
  await assertDocumentResponse(handler)
  await assertServerFnResponse(handler, context)
  await assertServerRouteResponse(handler)
}

export function runGlobalMiddlewareDocumentLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: documentLoopIterations,
    buildRequest: buildDocumentRequest,
  })
}

export function runGlobalMiddlewareServerFnLoop(
  handler: StartRequestHandler,
  context: GlobalMiddlewareBenchContext,
) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: serverFnLoopIterations,
    buildRequest: (_random, index) =>
      buildPostRequest(context.urls, context.bodies, index),
  })
}

export function runGlobalMiddlewareServerRouteLoop(
  handler: StartRequestHandler,
) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: serverRouteLoopIterations,
    buildRequest: buildServerRouteRequest,
  })
}
