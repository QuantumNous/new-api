import { fromCrossJSON, toJSONAsync } from 'seroval'
import {
  createDeterministicRandom,
  randomSegment,
  runRequestLoop,
} from '../../bench-utils'
import type { StartRequestHandler } from '../../bench-utils'
import type { SerovalNode } from 'seroval'

export type { StartRequestHandler }

type Payload = {
  q: string
  n: number
  nested: { list: Array<string> }
}

type FnUrls = {
  get: string
  post: string
  redirect: string
  notFound: string
  context: string
}

export type ServerFnBenchContext = {
  urls: FnUrls
  bodies: Array<string>
  getQueries: Array<string>
  expectedMarker: string
  contextBodies: Array<string>
  contextExpectedMarkers: Array<string>
  contextExpectedStamps: Array<string>
}

const benchmarkSeed = 0xdecafbad
const origin = 'http://localhost'
const tssContentTypeFramed = 'application/x-tss-framed'
const xTssSerialized = 'x-tss-serialized'
const acceptHeader = `${tssContentTypeFramed}, application/x-ndjson, application/json`
const commonHeaders = {
  'x-tsr-serverFn': 'true',
  'sec-fetch-site': 'same-origin',
  accept: acceptHeader,
} satisfies HeadersInit
const postHeaders = {
  ...commonHeaders,
  'content-type': 'application/json',
} satisfies HeadersInit
const documentRequestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit
const serverFnGetLoopIterations = 100
const serverFnPostLoopIterations = 150
const serverFnRedirectLoopIterations = 125
const serverFnNotFoundLoopIterations = 200
const serverFnSendContextLoopIterations = 175
const serverFnDocumentSsrLoopIterations = 45

export const serverFnBenchOptions = {
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

function createContextToken(payload: Payload) {
  return `token-${payload.q}-${payload.nested.list[0]}`
}

async function createContextFixtures(payloads: Array<Payload>) {
  return await Promise.all(
    payloads.map(async (payload) => {
      const token = createContextToken(payload)

      return {
        body: JSON.stringify(
          await toJSONAsync({ data: payload, context: { token } }),
        ),
        marker: `ctx-${token}-${payload.nested.list[0]}`,
        stamp: `stamp-${token}`,
      }
    }),
  )
}

function createGetQueries(bodies: Array<string>) {
  return bodies.map((body) => `?${new URLSearchParams({ payload: body })}`)
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
  const requiredKeys = [
    'get',
    'post',
    'redirect',
    'notFound',
    'context',
  ] as const

  for (const key of requiredKeys) {
    if (typeof urls[key] !== 'string') {
      throw new Error(
        `URL discovery returned invalid payload: ${JSON.stringify(urls)}`,
      )
    }
  }

  return urls as FnUrls
}

function validateSerializedResponse(response: Response, label: string) {
  if (response.status === 403) {
    throw new Error(
      `${label} sanity check failed with 403. Check CSRF headers.`,
    )
  }

  if (response.status === 404) {
    throw new Error(
      `${label} sanity check failed with 404. The discovered server function URL is stale.`,
    )
  }

  if (response.status !== 200) {
    throw new Error(`${label} request failed with status ${response.status}`)
  }

  if (!response.headers.get(xTssSerialized)) {
    throw new Error(`${label} response missing ${xTssSerialized} header`)
  }
}

function validateRedirectResponse(response: Response) {
  if (response.status !== 200) {
    throw new Error(`redirect request failed with status ${response.status}`)
  }

  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('application/json')) {
    throw new Error(`redirect response was not JSON: ${contentType}`)
  }
}

function validateDocumentResponse(response: Response) {
  if (response.status !== 200) {
    throw new Error(`document request failed with status ${response.status}`)
  }

  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('text/html')) {
    throw new Error(`document response was not HTML: ${contentType}`)
  }
}

async function readSerializedServerFnResult(response: Response, label: string) {
  const text = await response.text()

  validateSerializedResponse(response, label)

  let json: unknown

  try {
    json = JSON.parse(text)
  } catch (error) {
    throw new Error(`${label} sanity check returned invalid JSON: ${text}`, {
      cause: error,
    })
  }

  return { text, decoded: fromCrossJSON(json as SerovalNode, {}) }
}

async function assertServerFnResponse({
  response,
  label,
  expectedMarker,
}: {
  response: Response
  label: string
  expectedMarker: string
}) {
  const { text } = await readSerializedServerFnResult(response, label)

  if (!text.includes(expectedMarker)) {
    throw new Error(
      `${label} sanity check did not include expected marker ${expectedMarker}: ${text}`,
    )
  }
}

async function assertServerFnRedirectResponse(response: Response) {
  const text = await response.text()

  if (response.status !== 200) {
    throw new Error(
      `redirect sanity check failed with status ${response.status}: ${text}`,
    )
  }

  let payload: {
    href?: string
    isSerializedRedirect?: boolean
    statusCode?: number
  }

  try {
    payload = JSON.parse(text) as typeof payload
  } catch (error) {
    throw new Error(`redirect sanity check returned invalid JSON: ${text}`, {
      cause: error,
    })
  }

  if (
    payload.href !== '/' ||
    payload.statusCode !== 307 ||
    payload.isSerializedRedirect !== true
  ) {
    throw new Error(
      `redirect sanity check expected serialized redirect to /, got ${text}`,
    )
  }
}

async function assertServerFnNotFoundResponse(response: Response) {
  const { decoded } = await readSerializedServerFnResult(response, 'not-found')
  const payload = decoded as { error?: { isNotFound?: boolean } }

  if (payload.error?.isNotFound !== true) {
    throw new Error(
      `not-found sanity check did not include isNotFound error: ${JSON.stringify(decoded)}`,
    )
  }
}

async function assertServerFnContextResponse({
  response,
  expectedMarker,
  expectedStamp,
}: {
  response: Response
  expectedMarker: string
  expectedStamp: string
}) {
  const { decoded } = await readSerializedServerFnResult(
    response,
    'send-context',
  )
  const payload = decoded as {
    result?: { marker?: string; token?: string }
    context?: { stamp?: string }
  }

  if (payload.result?.marker !== expectedMarker) {
    throw new Error(
      `send-context sanity check expected result marker ${expectedMarker}, got ${JSON.stringify(decoded)}`,
    )
  }

  if (payload.context?.stamp !== expectedStamp) {
    throw new Error(
      `send-context sanity check expected response context ${expectedStamp}, got ${JSON.stringify(decoded)}`,
    )
  }
}

async function assertDocumentServerFnCallResponse(response: Response) {
  const text = await response.text()
  const expectedMarker = 'out-ssr-call-sanity-ssr'

  if (response.status !== 200) {
    throw new Error(
      `SSR-call sanity check failed with status ${response.status}: ${text}`,
    )
  }

  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('text/html')) {
    throw new Error(`SSR-call sanity check was not HTML: ${contentType}`)
  }

  if (response.headers.get(xTssSerialized)) {
    throw new Error('SSR-call sanity check returned a server-fn RPC response')
  }

  if (!text.includes('data-bench="server-fn-ssr-call"')) {
    throw new Error('SSR-call sanity check missing document marker')
  }

  if (!text.includes(expectedMarker)) {
    throw new Error(
      `SSR-call sanity check missing expected marker ${expectedMarker}`,
    )
  }
}

function buildGetRequest(urls: FnUrls, queries: Array<string>, index: number) {
  return new Request(`${origin}${urls.get}${queries[index % queries.length]}`, {
    method: 'GET',
    headers: commonHeaders,
  })
}

function buildPostUrlRequest(
  url: string,
  bodies: Array<string>,
  index: number,
) {
  return new Request(`${origin}${url}`, {
    method: 'POST',
    headers: postHeaders,
    body: bodies[index % bodies.length],
  })
}

function buildPostRequest(urls: FnUrls, bodies: Array<string>, index: number) {
  return buildPostUrlRequest(urls.post, bodies, index)
}

function buildRedirectRequest(
  urls: FnUrls,
  bodies: Array<string>,
  index: number,
) {
  return buildPostUrlRequest(urls.redirect, bodies, index)
}

function buildNotFoundRequest(
  urls: FnUrls,
  bodies: Array<string>,
  index: number,
) {
  return buildPostUrlRequest(urls.notFound, bodies, index)
}

function buildContextRequest(
  urls: FnUrls,
  contextBodies: Array<string>,
  index: number,
) {
  return buildPostUrlRequest(urls.context, contextBodies, index)
}

function buildSsrCallRequest(random: () => number) {
  return new Request(
    `${origin}/ssr-call/${randomSegment(random)}`,
    documentRequestInit,
  )
}

export async function setupServerFnBench(handler: StartRequestHandler) {
  const urls = await discoverUrls(handler)
  const payloads = createPayloads()
  const bodies = await createBodies(payloads)
  const contextFixtures = await createContextFixtures(payloads)
  const getQueries = createGetQueries(bodies)
  const expectedMarker = `out-${payloads[0]!.nested.list[0]}`

  return {
    urls,
    bodies,
    getQueries,
    expectedMarker,
    contextBodies: contextFixtures.map((fixture) => fixture.body),
    contextExpectedMarkers: contextFixtures.map((fixture) => fixture.marker),
    contextExpectedStamps: contextFixtures.map((fixture) => fixture.stamp),
  }
}

export async function assertServerFnScenario(
  handler: StartRequestHandler,
  context: ServerFnBenchContext,
) {
  await assertServerFnResponse({
    response: await handler.fetch(
      buildGetRequest(context.urls, context.getQueries, 0),
    ),
    label: 'GET',
    expectedMarker: context.expectedMarker,
  })
  await assertServerFnResponse({
    response: await handler.fetch(
      buildPostRequest(context.urls, context.bodies, 0),
    ),
    label: 'POST',
    expectedMarker: context.expectedMarker,
  })
  await assertServerFnRedirectResponse(
    await handler.fetch(buildRedirectRequest(context.urls, context.bodies, 0)),
  )
  await assertServerFnNotFoundResponse(
    await handler.fetch(buildNotFoundRequest(context.urls, context.bodies, 0)),
  )
  await assertServerFnContextResponse({
    response: await handler.fetch(
      buildContextRequest(context.urls, context.contextBodies, 0),
    ),
    expectedMarker: context.contextExpectedMarkers[0]!,
    expectedStamp: context.contextExpectedStamps[0]!,
  })
  await assertDocumentServerFnCallResponse(
    await handler.fetch(
      new Request(`${origin}/ssr-call/sanity-ssr`, documentRequestInit),
    ),
  )
}

export function runServerFnGetRequestLoop(
  handler: StartRequestHandler,
  context: ServerFnBenchContext,
) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: serverFnGetLoopIterations,
    buildRequest: (_random, index) =>
      buildGetRequest(context.urls, context.getQueries, index),
  })
}

export function runServerFnPostRequestLoop(
  handler: StartRequestHandler,
  context: ServerFnBenchContext,
) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: serverFnPostLoopIterations,
    buildRequest: (_random, index) =>
      buildPostRequest(context.urls, context.bodies, index),
  })
}

export function runServerFnRedirectRequestLoop(
  handler: StartRequestHandler,
  context: ServerFnBenchContext,
) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: serverFnRedirectLoopIterations,
    buildRequest: (_random, index) =>
      buildRedirectRequest(context.urls, context.bodies, index),
    validateResponse: validateRedirectResponse,
  })
}

export function runServerFnNotFoundRequestLoop(
  handler: StartRequestHandler,
  context: ServerFnBenchContext,
) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: serverFnNotFoundLoopIterations,
    buildRequest: (_random, index) =>
      buildNotFoundRequest(context.urls, context.bodies, index),
    validateResponse: (response) =>
      validateSerializedResponse(response, 'not-found'),
  })
}

export function runServerFnSendContextRequestLoop(
  handler: StartRequestHandler,
  context: ServerFnBenchContext,
) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: serverFnSendContextLoopIterations,
    buildRequest: (_random, index) =>
      buildContextRequest(context.urls, context.contextBodies, index),
    validateResponse: (response) =>
      validateSerializedResponse(response, 'send-context'),
  })
}

export function runServerFnDocumentSsrRequestLoop(
  handler: StartRequestHandler,
) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: serverFnDocumentSsrLoopIterations,
    buildRequest: buildSsrCallRequest,
    validateResponse: validateDocumentResponse,
  })
}
