import type { AnyRouter } from '../router'

export type SsrResponse =
  | {
      response: Response
      serverSsrCleanup: 'none'
    }
  | {
      response: Response
      serverSsrCleanup: 'stream'
      dispose: (reason?: unknown) => Promise<void>
    }

export type HandlerCallbackResult = Response | SsrResponse

export function isSsrResponse(value: unknown): value is SsrResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'response' in value &&
    'serverSsrCleanup' in value
  )
}

export function normalizeSsrResponse(
  result: HandlerCallbackResult,
): SsrResponse {
  return isSsrResponse(result)
    ? result
    : { response: result, serverSsrCleanup: 'none' }
}

export function createSsrStreamResponse<TRouter extends AnyRouter>(
  router: TRouter,
  response: Response,
): SsrResponse {
  if (!response.body) {
    throw new Error('Invariant failed: SSR stream response requires a body')
  }

  let disposed = false
  return {
    response,
    serverSsrCleanup: 'stream',
    async dispose(reason?: unknown) {
      if (disposed) return
      disposed = true

      try {
        await response.body!.cancel(reason)
      } catch {
        // ignore; fallback cleanup below still releases router SSR state
      }

      router.serverSsr?.cleanup()
    },
  }
}

export async function replaceSsrResponse(
  result: HandlerCallbackResult,
  response: Response,
  reason?: unknown,
): Promise<SsrResponse> {
  const ssrResponse = normalizeSsrResponse(result)
  if (ssrResponse.serverSsrCleanup === 'stream') {
    await ssrResponse.dispose(reason)
  }
  return { response, serverSsrCleanup: 'none' }
}

export async function stripSsrResponseBody(
  result: HandlerCallbackResult,
  reason?: unknown,
): Promise<SsrResponse> {
  const ssrResponse = normalizeSsrResponse(result)
  if (ssrResponse.serverSsrCleanup === 'stream') {
    await ssrResponse.dispose(reason)
  }
  return {
    response: new Response(null, ssrResponse.response),
    serverSsrCleanup: 'none',
  }
}

export interface HandlerCallback<TRouter extends AnyRouter> {
  (ctx: {
    request: Request
    router: TRouter
    responseHeaders: Headers
  }): HandlerCallbackResult | Promise<HandlerCallbackResult>
}

export function defineHandlerCallback<TRouter extends AnyRouter>(
  handler: HandlerCallback<TRouter>,
): HandlerCallback<TRouter> {
  return handler
}
