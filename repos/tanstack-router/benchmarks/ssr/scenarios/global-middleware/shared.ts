export interface GlobalMiddlewareContext {
  requestTrace?: string
  requestTotal?: number
  functionTrace?: string
  functionTotal?: number
}

export interface GlobalMiddlewareRouteContext extends GlobalMiddlewareContext {
  serverContext?: GlobalMiddlewareContext
  globalMiddlewareContext?: GlobalMiddlewareContext
}

export const expectedRequestTrace = 'req.r1.r2.r3'
export const expectedRequestTotal = 6
export const expectedFunctionTrace = 'fn.f1.f2'
export const expectedFunctionTotal = 30

export function makeDocumentMarker(
  id: string,
  context: GlobalMiddlewareContext,
) {
  return `document:${context.requestTrace}:${id}:${context.requestTotal}`
}

export function getGlobalMiddlewareContext(context: unknown) {
  const routeContext = (context ?? {}) as GlobalMiddlewareRouteContext

  return (
    routeContext.globalMiddlewareContext ??
    routeContext.serverContext ??
    routeContext
  )
}

export function makeServerRouteMarker(
  id: string,
  context: GlobalMiddlewareContext,
) {
  return `route:${context.requestTrace}:${id}:${context.requestTotal}`
}

export function makeServerFnMarker(
  q: string,
  context: GlobalMiddlewareContext,
) {
  return `fn:${context.requestTrace}:${context.functionTrace}:${q}:${context.requestTotal}:${context.functionTotal}`
}
