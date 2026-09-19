export type { JsonResponse } from '@tanstack/router-core/ssr/client'

export { hydrate, json, mergeHeaders } from '@tanstack/router-core/ssr/client'

export { RawStream } from '@tanstack/router-core'
export type { OnRawStreamCallback } from '@tanstack/router-core'

export {
  createIsomorphicFn,
  createServerOnlyFn,
  createClientOnlyFn,
  type IsomorphicFn,
  type ServerOnlyFn,
  type ClientOnlyFn,
  type IsomorphicFnBase,
} from '@tanstack/start-fn-stubs'
export { createServerFn } from './createServerFn'
export {
  createMiddleware,
  type IntersectAllValidatorInputs,
  type IntersectAllValidatorOutputs,
  type FunctionMiddlewareServerFn,
  type AnyFunctionMiddleware,
  type FunctionMiddlewareOptions,
  type FunctionMiddlewareWithTypes,
  type FunctionMiddlewareValidator,
  type FunctionMiddlewareServer,
  type FunctionMiddlewareAfterClient,
  type FunctionMiddlewareAfterServer,
  type FunctionMiddleware,
  type FunctionMiddlewareAfterMiddleware,
  type FunctionMiddlewareClientFnOptions,
  type FunctionMiddlewareClientFnResult,
  type FunctionMiddlewareClientNextFn,
  type FunctionClientResultWithContext,
  type AssignAllClientContextBeforeNext,
  type AssignAllMiddleware,
  type FunctionMiddlewareAfterValidator,
  type FunctionMiddlewareClientFn,
  type FunctionMiddlewareServerFnResult,
  type FunctionMiddlewareClient,
  type FunctionMiddlewareServerFnOptions,
  type FunctionMiddlewareServerNextFn,
  type FunctionServerResultWithContext,
  type AnyRequestMiddleware,
  type RequestMiddlewareOptions,
  type RequestMiddlewareWithTypes,
  type RequestMiddlewareServer,
  type RequestMiddlewareAfterServer,
  type RequestMiddleware,
  type RequestMiddlewareAfterMiddleware,
  type RequestServerFn,
  type RequestMiddlewareServerFnResult,
  type RequestServerOptions,
  type RequestServerNextFn,
  type RequestServerNextFnOptions,
  type RequestServerResult,
} from './createMiddleware'
export type {
  CompiledFetcherFnOptions,
  CompiledFetcherFn,
  CustomFetch,
  Fetcher,
  RscStream,
  FetcherBaseOptions,
  ServerFn,
  ServerFnCtx,
  ServerFnOptions,
  ServerFnStrict,
  ServerFnStrictInput,
  ServerFnStrictOutput,
  MiddlewareFn,
  ServerFnMiddlewareOptions,
  ServerFnMiddlewareResult,
  ServerFnBuilder,
  ServerFnBaseOptions,
  NextFn,
  Method,
  OptionalFetcher,
  RequiredFetcher,
} from './createServerFn'
export {
  execValidator,
  flattenMiddlewares,
  executeMiddleware,
} from './createServerFn'
export {
  createCsrfMiddleware,
  csrfSymbol,
  getCsrfRequestValidationResult,
  isCsrfRequestAllowed,
} from './createCsrfMiddleware'
export type {
  CsrfMatcher,
  CsrfMiddlewareOptions,
  CsrfSecFetchSite,
} from './createCsrfMiddleware'

export {
  TSS_FORMDATA_CONTEXT,
  TSS_SERVER_FUNCTION,
  TSS_CONTENT_TYPE_FRAMED,
  TSS_CONTENT_TYPE_FRAMED_VERSIONED,
  TSS_FRAMED_PROTOCOL_VERSION,
  FrameType,
  FRAME_HEADER_SIZE,
  X_TSS_SERIALIZED,
  X_TSS_RAW_RESPONSE,
  X_TSS_CONTEXT,
  validateFramedProtocolVersion,
} from './constants'
export type {
  FrameType as FrameTypeValue,
  ClientFnMeta,
  ServerFnMeta,
} from './constants'

export type * from './serverRoute'

export type * from './startEntry'

export { createStart } from './createStart'
export type {
  AnyStartInstance,
  AnyStartInstanceOptions,
  StartInstance,
  StartInstanceOptions,
} from './createStart'
export type { Register } from '@tanstack/router-core'

export { getRouterInstance } from './getRouterInstance'
export { getDefaultSerovalPlugins } from './getDefaultSerovalPlugins'
export { getGlobalStartContext } from './getGlobalStartContext'
export { safeObjectMerge, createNullProtoObject } from './safeObjectMerge'
export { trackPostProcessPromise } from './client-rpc/serverFnFetcher'
