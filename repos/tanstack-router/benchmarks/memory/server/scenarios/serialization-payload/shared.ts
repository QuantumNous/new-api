import {
  randomSegment,
  runSequentialRequestLoop,
} from '#memory-server/bench-utils'
import type { StartRequestHandler } from '#memory-server/bench-utils'

export type { StartRequestHandler }

type Framework = 'react' | 'solid' | 'vue'

const benchmarkSeed = 0x51eaa11
const serializationPayloadIterations = 20
const payloadPageMarker = 'data-bench="serialization-payload"'

const requestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

function buildPayloadRequest(random: () => number, index: number) {
  const id = `payload-${index}-${randomSegment(random)}`

  return new Request(`http://localhost/data/${id}`, requestInit)
}

function validatePayloadResponse(response: Response, request: Request) {
  if (response.status !== 200) {
    throw new Error(
      `Expected status 200 for ${request.url}, got ${response.status}`,
    )
  }
}

function validatePayloadBody(body: string) {
  if (!body.includes(payloadPageMarker)) {
    throw new Error('Expected serialization-payload marker in response body')
  }
}

async function assertSerializationPayloadSanity(handler: StartRequestHandler) {
  const request = new Request(
    'http://localhost/data/sanity-payload',
    requestInit,
  )
  const response = await handler.fetch(request)
  const body = await response.text()

  validatePayloadResponse(response, request)
  validatePayloadBody(body)
}

export function createWorkloadGroup(
  framework: Framework,
  handler: StartRequestHandler,
) {
  const run = () =>
    runSequentialRequestLoop(handler, {
      seed: benchmarkSeed,
      iterations: serializationPayloadIterations,
      buildRequest: buildPayloadRequest,
      validateResponse: validatePayloadResponse,
    })

  return {
    sanity: () => assertSerializationPayloadSanity(handler),
    workloads: [
      {
        name: `mem serialization-payload (${framework})`,
        run,
      },
    ],
  }
}
