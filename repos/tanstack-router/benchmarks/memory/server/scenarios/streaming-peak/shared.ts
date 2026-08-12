import {
  randomSegment,
  runSequentialRequestLoop,
} from '#memory-server/bench-utils'
import type { StartRequestHandler } from '#memory-server/bench-utils'

export type { StartRequestHandler }

type Framework = 'react' | 'solid' | 'vue'

const benchmarkSeed = 0xdecafbad
const streamingPeakIterations = 20
const fallbackMarker = 'streaming-peak-fallback-0'

const requestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

function buildStreamingRequest(random: () => number, index: number) {
  return new Request(
    `http://localhost/stream/${index}-${randomSegment(random)}`,
    requestInit,
  )
}

function validateStreamingResponse(response: Response, request: Request) {
  if (response.status !== 200) {
    throw new Error(
      `Expected status 200 for ${request.url}, got ${response.status}`,
    )
  }
}

function getResponseReader(response: Response) {
  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error('Expected streaming response body')
  }

  return reader
}

async function readStreamingBody(response: Response) {
  const reader = getResponseReader(response)
  const decoder = new TextDecoder()
  let body = ''
  let chunkCount = 0

  while (true) {
    const result = await reader.read()

    if (result.done) {
      break
    }

    chunkCount++
    body += decoder.decode(result.value, { stream: true })
  }

  body += decoder.decode()

  return { body, chunkCount }
}

async function assertStreamingPeakSanity(handler: StartRequestHandler) {
  const chunkedRequest = new Request(
    'http://localhost/stream/sanity-chunked',
    requestInit,
  )
  const chunkedResponse = await handler.fetch(chunkedRequest)

  validateStreamingResponse(chunkedResponse, chunkedRequest)

  const chunked = await readStreamingBody(chunkedResponse)

  if (chunked.chunkCount <= 1) {
    throw new Error(
      `Expected chunked sanity response to produce multiple chunks, got ${chunked.chunkCount}`,
    )
  }

  if (!chunked.body.includes(fallbackMarker)) {
    throw new Error('Expected streaming-peak fallback marker in response body')
  }
}

export function createWorkloadGroup(
  framework: Framework,
  handler: StartRequestHandler,
) {
  const run = () =>
    runSequentialRequestLoop(handler, {
      seed: benchmarkSeed,
      iterations: streamingPeakIterations,
      buildRequest: buildStreamingRequest,
      validateResponse: validateStreamingResponse,
    })

  return {
    sanity: () => assertStreamingPeakSanity(handler),
    workloads: [
      {
        name: `mem streaming-peak chunked (${framework})`,
        run,
      },
    ],
  }
}
