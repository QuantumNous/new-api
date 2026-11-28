export interface BeforeLoadContext {
  chainToken?: string
  ctxA?: string
  ctxB?: string
  ctxC?: string
}

export function makeBeforeLoadMarker(context: BeforeLoadContext) {
  return `ctx:${context.ctxA}:${context.ctxB}:${context.ctxC}:${context.chainToken}`
}
