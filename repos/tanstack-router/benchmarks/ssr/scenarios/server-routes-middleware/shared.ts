import { randomSegment, runRequestLoop } from '../../bench-utils'
import type { StartRequestHandler } from '../../bench-utils'

export type { StartRequestHandler }

const benchmarkSeed = 0xdecafbad
const loopIterations = 150

const apiRequestInit = {
  method: 'GET',
  headers: {
    accept: 'application/json',
  },
} satisfies RequestInit

export const serverRouteMiddlewareBenchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}

export function runServerRouteMiddlewareLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: loopIterations,
    buildRequest: (random) =>
      new Request(
        `http://localhost/api/chain/${randomSegment(random)}`,
        apiRequestInit,
      ),
  })
}

export async function assertServerRouteMiddlewareResponse(
  handler: StartRequestHandler,
) {
  const id = 'sanity'
  const response = await handler.fetch(
    new Request(`http://localhost/api/chain/${id}`, apiRequestInit),
  )

  if (response.status !== 200) {
    throw new Error(`Expected status 200, received ${response.status}`)
  }

  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('application/json')) {
    throw new Error(`Expected JSON response, received ${contentType}`)
  }

  const body = (await response.json()) as { total?: number }

  if (body.total !== 28) {
    throw new Error(`Expected total 28, received ${body.total}`)
  }
}
