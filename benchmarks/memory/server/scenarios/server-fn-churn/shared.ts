import {
  createDeterministicRandom,
  randomSegment,
  runSequentialRequestLoop,
} from '#memory-server/bench-utils'
import type { StartRequestHandler } from '#memory-server/bench-utils'

export type { StartRequestHandler }

type Framework = 'react' | 'solid' | 'vue'

type FnUrls = {
  get: string
  post: string
}

type PayloadFixture = {
  id: string
  body: string
  query: string
}

type SerovalNode =
  | {
      t: 1
      s: string
    }
  | {
      t: 10
      i: number
      p: {
        k: Array<string>
        v: Array<SerovalNode>
      }
      o: number
    }

const benchmarkSeed = 0xdecafbad
const payloadSeed = 0x51f0cafe
const fixtureCount = 16
const serverFnChurnIterations = 150
const origin = 'http://localhost'
const tssContentTypeFramed = 'application/x-tss-framed'
const acceptHeader = `${tssContentTypeFramed}, application/x-ndjson, application/json`
const xTssSerialized = 'x-tss-serialized'
const contextMarker = 'ctx-server-fn-churn'

const commonHeaders = {
  'x-tsr-serverFn': 'true',
  'sec-fetch-site': 'same-origin',
  accept: acceptHeader,
} satisfies HeadersInit

const postHeaders = {
  ...commonHeaders,
  'content-type': 'application/json',
} satisfies HeadersInit

// Hand-rolled copy of Start's seroval RPC wire format so POST bodies can be
// precomputed at module level. Coupled to the internal protocol on purpose;
// the module-load sanity check below throws loudly if the protocol drifts.
function stringNode(value: string): SerovalNode {
  return { t: 1, s: value }
}

function objectNode(
  id: number,
  entries: Array<readonly [string, SerovalNode]>,
): SerovalNode {
  return {
    t: 10,
    i: id,
    p: {
      k: entries.map(([key]) => key),
      v: entries.map(([, value]) => value),
    },
    o: 0,
  }
}

function serializePayload(id: string) {
  return JSON.stringify({
    t: objectNode(0, [['data', objectNode(1, [['id', stringNode(id)]])]]),
    f: 63,
    m: [],
  })
}

function createFixtures(kind: 'get' | 'post') {
  const random = createDeterministicRandom(payloadSeed ^ kind.length)

  return Array.from({ length: fixtureCount }, (_, index): PayloadFixture => {
    const id = [kind, index, randomSegment(random), randomSegment(random)].join(
      '-',
    )
    const body = serializePayload(id)

    return {
      id,
      body,
      query: `?${new URLSearchParams({ payload: body })}`,
    }
  })
}

const getFixtures = createFixtures('get')
const postFixtures = createFixtures('post')

async function discoverUrls(handler: StartRequestHandler) {
  const response = await handler.fetch(new Request(`${origin}/api/fn-urls`))
  const text = await response.text()

  if (response.status !== 200) {
    throw new Error(
      `URL discovery failed with status ${response.status}: ${text}`,
    )
  }

  let urls: Partial<FnUrls>

  try {
    urls = JSON.parse(text) as Partial<FnUrls>
  } catch (error) {
    throw new Error(`URL discovery returned invalid JSON: ${text}`, {
      cause: error,
    })
  }

  if (typeof urls.get !== 'string' || typeof urls.post !== 'string') {
    throw new Error(`URL discovery returned invalid payload: ${text}`)
  }

  return urls as FnUrls
}

function buildGetRequest(url: string, fixture: PayloadFixture) {
  return new Request(`${origin}${url}${fixture.query}`, {
    method: 'GET',
    headers: commonHeaders,
  })
}

function buildPostRequest(url: string, fixture: PayloadFixture) {
  return new Request(`${origin}${url}`, {
    method: 'POST',
    headers: postHeaders,
    body: fixture.body,
  })
}

function validateServerFnResponse(response: Response, request: Request) {
  if (response.status !== 200) {
    throw new Error(
      `Expected status 200 for ${request.url}, got ${response.status}`,
    )
  }

  if (!response.headers.get(xTssSerialized)) {
    throw new Error(`Expected ${xTssSerialized} header for ${request.url}`)
  }
}

function validateEchoedBody(
  body: string,
  request: Request,
  expectedId: string,
) {
  if (!body.includes(expectedId)) {
    throw new Error(`Expected echoed id ${expectedId} in ${request.url}`)
  }

  if (!body.includes(contextMarker)) {
    throw new Error(
      `Expected context marker ${contextMarker} in ${request.url}`,
    )
  }
}

async function assertServerFnChurnSanity(
  handler: StartRequestHandler,
  urls: FnUrls,
) {
  const getFixture = getFixtures[0]!
  const getRequest = buildGetRequest(urls.get, getFixture)
  const getResponse = await handler.fetch(getRequest)
  const getBody = await getResponse.text()

  validateServerFnResponse(getResponse, getRequest)
  validateEchoedBody(getBody, getRequest, getFixture.id)

  const postFixture = postFixtures[0]!
  const postRequest = buildPostRequest(urls.post, postFixture)
  const postResponse = await handler.fetch(postRequest)
  const postBody = await postResponse.text()

  validateServerFnResponse(postResponse, postRequest)
  validateEchoedBody(postBody, postRequest, postFixture.id)
}

export async function createWorkloadGroup(
  framework: Framework,
  handler: StartRequestHandler,
) {
  const urls = await discoverUrls(handler)
  const run = () =>
    runSequentialRequestLoop(handler, {
      seed: benchmarkSeed,
      iterations: serverFnChurnIterations,
      buildRequest: (_random, index) => {
        const fixtureIndex = Math.floor(index / 2) % fixtureCount

        if (index % 2 === 0) {
          const fixture = getFixtures[fixtureIndex]!
          return buildGetRequest(urls.get, fixture)
        } else {
          const fixture = postFixtures[fixtureIndex]!
          return buildPostRequest(urls.post, fixture)
        }
      },
      validateResponse: validateServerFnResponse,
    })

  return {
    sanity: () => assertServerFnChurnSanity(handler, urls),
    workloads: [
      {
        name: `mem server-fn-churn (${framework})`,
        run,
      },
    ],
  }
}
