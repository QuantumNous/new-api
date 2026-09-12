import { randomSegment, runRequestLoop } from '../../bench-utils'
import type { StartRequestHandler } from '../../bench-utils'

export type { StartRequestHandler }

const benchmarkSeed = 0xdecafbad
const loopIterations = 200

const apiRequestInit = {
  method: 'GET',
  headers: {
    accept: 'application/json',
  },
} satisfies RequestInit

export const serverRouteBenchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}

export function runServerRouteLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: loopIterations,
    buildRequest: (random) =>
      new Request(
        `http://localhost/api/users/${randomSegment(random)}`,
        apiRequestInit,
      ),
  })
}

export async function assertServerRouteResponse(handler: StartRequestHandler) {
  const id = 'sanity'
  const response = await handler.fetch(
    new Request(`http://localhost/api/users/${id}`, apiRequestInit),
  )

  if (response.status !== 200) {
    throw new Error(`Expected status 200, received ${response.status}`)
  }

  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('application/json')) {
    throw new Error(`Expected JSON response, received ${contentType}`)
  }

  const body = (await response.json()) as { name?: string }

  if (body.name !== `user-${id}`) {
    throw new Error(`Expected user-${id}, received ${body.name}`)
  }
}
