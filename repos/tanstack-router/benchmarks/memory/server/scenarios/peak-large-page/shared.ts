import { runSequentialRequestLoop } from '#memory-server/bench-utils'
import type { StartRequestHandler } from '#memory-server/bench-utils'

export type { StartRequestHandler }

type Framework = 'react' | 'solid' | 'vue'

const benchmarkSeed = 0x5eed_0005
const peakLargePageIterations = 20
const peakLargePageUrl = 'http://localhost/l1/l2/l3/l4/l5/l6/l7/l8'
const levelEightMarker = 'data-bench="peak-large-page-level-8"'

const requestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

function buildPeakLargePageRequest() {
  return new Request(peakLargePageUrl, requestInit)
}

function validatePeakLargePageResponse(response: Response, request: Request) {
  if (response.status !== 200) {
    throw new Error(
      `Expected status 200 for ${request.url}, got ${response.status}`,
    )
  }
}

function validatePeakLargePageBody(body: string) {
  if (!body.includes(levelEightMarker)) {
    throw new Error('Expected peak-large-page level-8 marker in response body')
  }
}

async function assertPeakLargePageSanity(handler: StartRequestHandler) {
  const request = new Request(peakLargePageUrl, requestInit)
  const response = await handler.fetch(request)
  const body = await response.text()

  validatePeakLargePageResponse(response, request)
  validatePeakLargePageBody(body)
}

export function createWorkloadGroup(
  framework: Framework,
  handler: StartRequestHandler,
) {
  const run = () =>
    runSequentialRequestLoop(handler, {
      seed: benchmarkSeed,
      iterations: peakLargePageIterations,
      buildRequest: buildPeakLargePageRequest,
      validateResponse: validatePeakLargePageResponse,
      pinGcBetweenIterations: true,
      verifyGcFloor: true,
    })

  return {
    sanity: () => assertPeakLargePageSanity(handler),
    workloads: [
      {
        name: `mem server peak-large-page (${framework})`,
        run,
      },
    ],
  }
}
