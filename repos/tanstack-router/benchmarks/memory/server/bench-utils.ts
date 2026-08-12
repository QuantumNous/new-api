export interface StartRequestHandler {
  fetch: (request: Request) => Promise<Response> | Response
}

type RunSequentialRequestLoopRandomOptions =
  | {
      seed: number
      random?: never
    }
  | {
      random: () => number
      seed?: never
    }

export type RunSequentialRequestLoopOptions =
  RunSequentialRequestLoopRandomOptions & {
    iterations?: number
    buildRequest: (random: () => number, index: number) => Request
    validateResponse?: (response: Response, request: Request) => void
  }

export const memoryBenchOptions = {
  iterations: 1,
  warmupIterations: 1,
  time: 0,
  warmupTime: 0,
  throws: true,
}

export function createDeterministicRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export function randomSegment(random: () => number) {
  return Math.floor(random() * 1_000_000_000).toString(36)
}

export async function drainResponse(response: Response) {
  const reader = response.body?.getReader()

  if (!reader) {
    return
  }

  try {
    while (true) {
      const result = await reader.read()

      if (result.done) {
        break
      }
    }
  } finally {
    reader.releaseLock()
  }
}

export async function runSequentialRequestLoop(
  handler: StartRequestHandler,
  options: RunSequentialRequestLoopOptions,
) {
  const { iterations = 10, buildRequest, validateResponse } = options
  const random =
    options.seed !== undefined
      ? createDeterministicRandom(options.seed)
      : options.random
  const validate =
    validateResponse ??
    ((response: Response, request: Request) => {
      if (response.status !== 200) {
        throw new Error(
          `Request failed with non-200 status ${response.status} (${request.url})`,
        )
      }
    })

  for (let index = 0; index < iterations; index++) {
    const request = buildRequest(random, index)
    const response = await handler.fetch(request)

    validate(response, request)

    await drainResponse(response)
  }
}
