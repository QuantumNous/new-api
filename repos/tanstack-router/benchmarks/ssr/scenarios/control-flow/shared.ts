import { expect } from 'vitest'
import { randomSegment, runRequestLoop } from '../../bench-utils'
import type { StartRequestHandler } from '../../bench-utils'

export type { StartRequestHandler }

const benchmarkSeed = 0xdecafbad
const redirectLoopIterations = 100
const notFoundLoopIterations = 45
const errorLoopIterations = 45
const unmatchedLoopIterations = 60
const routeHeadersLoopIterations = 50

// Pinned to the current built handler responses for these control-flow routes.
const OK_STATUS = 200
const REDIRECT_STATUS = 307
const NOT_FOUND_STATUS = 404
const ERROR_STATUS = 500
const ROUTE_HEADERS_STATIC_VALUE = 'control-flow-route-headers'

const requestInit = {
  method: 'GET',
  headers: {
    accept: 'text/html',
  },
} satisfies RequestInit

export const controlFlowBenchOptions = {
  warmupIterations: 100,
  time: 10_000,
  throws: true,
}

function buildRedirectRequest(random: () => number) {
  return new Request(
    `http://localhost/from/${randomSegment(random)}`,
    requestInit,
  )
}

function buildNotFoundRequest(random: () => number) {
  return new Request(
    `http://localhost/missing/${randomSegment(random)}`,
    requestInit,
  )
}

function buildErrorRequest(random: () => number) {
  return new Request(
    `http://localhost/boom/${randomSegment(random)}`,
    requestInit,
  )
}

function buildUnmatchedRequest(random: () => number) {
  return new Request(
    `http://localhost/definitely-not-a-route/${randomSegment(random)}`,
    requestInit,
  )
}

function buildRouteHeadersRequest(random: () => number) {
  return new Request(
    `http://localhost/headers/${randomSegment(random)}`,
    requestInit,
  )
}

function getRequestId(request: Request) {
  const id = new URL(request.url).pathname.split('/').pop()

  if (!id) {
    throw new Error(`expected request id in ${request.url}`)
  }

  return id
}

function validateRedirectResponse(response: Response) {
  if (response.status !== REDIRECT_STATUS) {
    throw new Error(`expected ${REDIRECT_STATUS}, got ${response.status}`)
  }
}

function validateNotFoundResponse(response: Response) {
  if (response.status !== NOT_FOUND_STATUS) {
    throw new Error(`expected ${NOT_FOUND_STATUS}, got ${response.status}`)
  }
}

function validateErrorResponse(response: Response) {
  if (response.status !== ERROR_STATUS) {
    throw new Error(`expected ${ERROR_STATUS}, got ${response.status}`)
  }
}

function validateUnmatchedResponse(response: Response) {
  if (response.status !== NOT_FOUND_STATUS) {
    throw new Error(`expected ${NOT_FOUND_STATUS}, got ${response.status}`)
  }
}

function validateRouteHeadersResponse(response: Response, request: Request) {
  if (response.status !== OK_STATUS) {
    throw new Error(`expected ${OK_STATUS}, got ${response.status}`)
  }

  const id = getRequestId(request)
  const routeHeader = response.headers.get('x-bench-route-header')

  if (routeHeader !== `route-header-${id}`) {
    throw new Error(`expected route header for ${id}, got ${routeHeader}`)
  }

  const staticHeader = response.headers.get('x-bench-route-static')

  if (staticHeader !== ROUTE_HEADERS_STATIC_VALUE) {
    throw new Error(
      `expected route static header ${ROUTE_HEADERS_STATIC_VALUE}, got ${staticHeader}`,
    )
  }
}

export function runRedirectLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: redirectLoopIterations,
    buildRequest: buildRedirectRequest,
    validateResponse: validateRedirectResponse,
  })
}

export function runNotFoundLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: notFoundLoopIterations,
    buildRequest: buildNotFoundRequest,
    validateResponse: validateNotFoundResponse,
  })
}

export function runErrorLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: errorLoopIterations,
    buildRequest: buildErrorRequest,
    validateResponse: validateErrorResponse,
  })
}

export function runUnmatchedLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: unmatchedLoopIterations,
    buildRequest: buildUnmatchedRequest,
    validateResponse: validateUnmatchedResponse,
  })
}

export function runRouteHeadersLoop(handler: StartRequestHandler) {
  return runRequestLoop(handler, {
    seed: benchmarkSeed,
    iterations: routeHeadersLoopIterations,
    buildRequest: buildRouteHeadersRequest,
    validateResponse: validateRouteHeadersResponse,
  })
}

export async function assertControlFlowSanity(handler: StartRequestHandler) {
  const redirectId = 'sanity-redirect'
  const redirectResponse = await handler.fetch(
    new Request(`http://localhost/from/${redirectId}`, requestInit),
  )

  expect(redirectResponse.status).toBe(REDIRECT_STATUS)
  expect(redirectResponse.headers.get('location')).toBe(`/target/${redirectId}`)

  const notFoundResponse = await handler.fetch(
    new Request('http://localhost/missing/sanity-missing', requestInit),
  )
  const notFoundBody = await notFoundResponse.text()

  expect(notFoundResponse.status).toBe(NOT_FOUND_STATUS)
  expect(notFoundBody).toContain('root-not-found-marker')

  const errorId = 'sanity-error'
  const errorResponse = await handler.fetch(
    new Request(`http://localhost/boom/${errorId}`, requestInit),
  )
  const errorBody = await errorResponse.text()

  expect(errorResponse.status).toBe(ERROR_STATUS)
  expect(errorBody).toContain('data-bench="error-boundary"')
  const firstScriptIndex = errorBody.indexOf('<script')
  const renderedErrorBody =
    firstScriptIndex === -1 ? errorBody : errorBody.slice(0, firstScriptIndex)

  expect(renderedErrorBody).not.toContain(`boom-${errorId}`)

  const unmatchedResponse = await handler.fetch(
    new Request(
      'http://localhost/definitely-not-a-route/sanity-unmatched',
      requestInit,
    ),
  )
  const unmatchedBody = await unmatchedResponse.text()

  expect(unmatchedResponse.status).toBe(NOT_FOUND_STATUS)
  expect(unmatchedBody).toContain('root-not-found-marker')

  const routeHeadersId = 'sanity-headers'
  const routeHeadersResponse = await handler.fetch(
    new Request(`http://localhost/headers/${routeHeadersId}`, requestInit),
  )
  const routeHeadersBody = await routeHeadersResponse.text()

  expect(routeHeadersResponse.status).toBe(OK_STATUS)
  expect(routeHeadersResponse.headers.get('x-bench-route-header')).toBe(
    `route-header-${routeHeadersId}`,
  )
  expect(routeHeadersResponse.headers.get('x-bench-route-static')).toBe(
    ROUTE_HEADERS_STATIC_VALUE,
  )
  expect(routeHeadersBody).toContain(`headers-${routeHeadersId}`)
}
