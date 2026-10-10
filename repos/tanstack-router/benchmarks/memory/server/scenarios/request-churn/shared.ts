import {
  createDeterministicRandom,
  randomSegment,
  runSequentialRequestLoop,
} from '#memory-server/bench-utils'
import type { StartRequestHandler } from '#memory-server/bench-utils'

export type { StartRequestHandler }

type Framework = 'react' | 'solid' | 'vue'

const benchmarkSeed = 0xdecafbad
const requestChurnIterations = 40
const itemPageMarker = 'data-bench="request-churn-item"'
// Module-level so CodSpeed warmups and measurement never replay URLs.
const benchmarkRandom = createDeterministicRandom(benchmarkSeed)
let requestCounter = 0

const requestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

function validateItemResponse(response: Response, request: Request) {
  if (response.status !== 200) {
    throw new Error(
      `Expected status 200 for ${request.url}, got ${response.status}`,
    )
  }
}

function validateItemBody(body: string) {
  if (!body.includes(itemPageMarker)) {
    throw new Error('Expected request-churn item marker in response body')
  }
}

async function assertRequestChurnSanity(handler: StartRequestHandler) {
  const response = await handler.fetch(
    new Request('http://localhost/items/sanity-item?q=q-sanity', requestInit),
  )
  const body = await response.text()

  if (response.status !== 200) {
    throw new Error(`Expected sanity status 200, got ${response.status}`)
  }

  validateItemBody(body)
}

export function createWorkloadGroup(
  framework: Framework,
  handler: StartRequestHandler,
) {
  function buildItemRequest(random: () => number) {
    const counter = (requestCounter++).toString(36)
    const id = `${counter}-${randomSegment(random)}`
    const q = `q-${randomSegment(random)}`

    return new Request(`http://localhost/items/${id}?q=${q}`, requestInit)
  }

  const run = () =>
    runSequentialRequestLoop(handler, {
      random: benchmarkRandom,
      iterations: requestChurnIterations,
      buildRequest: buildItemRequest,
      validateResponse: validateItemResponse,
      pinGcBetweenIterations: true,
    })

  return {
    sanity: () => assertRequestChurnSanity(handler),
    workloads: [
      {
        name: `mem server request-churn (${framework})`,
        run,
      },
    ],
  }
}
