import { mergeHeaders } from '@tanstack/router-core/ssr/client'

import { isRedirect, parseRedirect } from '@tanstack/router-core'
import { TSS_SERVER_FUNCTION_FACTORY } from './constants'
import { getStartOptions } from './getStartOptions'
import { getStartContextServerOnly } from './getStartContextServerOnly'
import { createNullProtoObject, safeObjectMerge } from './safeObjectMerge'
import type {
  ClientFnMeta,
  ServerFnMeta,
  TSS_SERVER_FUNCTION,
} from './constants'
import type {
  AnyValidator,
  Constrain,
  Expand,
  Register,
  RegisteredSerializableInput,
  ResolveValidatorInput,
  ValidateSerializable,
  ValidateSerializableInput,
  Validator,
} from '@tanstack/router-core'
import type {
  AnyFunctionMiddleware,
  AnyRequestMiddleware,
  AssignAllServerFnContext,
  IntersectAllValidatorInputs,
  IntersectAllValidatorOutputs,
} from './createMiddleware'

export type ServerFnStrict = boolean | { input?: boolean; output?: boolean }

export interface ServerFnOptions<
  TMethod extends Method = Method,
  TStrict extends ServerFnStrict = true,
> {
  method?: TMethod
  strict?: TStrict
}

export type ServerFnStrictInput<TStrict extends ServerFnStrict> =
  TStrict extends false
    ? false
    : TStrict extends { input: infer TInput extends boolean }
      ? TInput
      : true

export type ServerFnStrictOutput<TStrict extends ServerFnStrict> =
  TStrict extends false
    ? false
    : TStrict extends { output: infer TOutput extends boolean }
      ? TOutput
      : true

export type CreateServerFn<TRegister> = <
  TMethod extends Method,
  TStrict extends ServerFnStrict = true,
  TResponse = unknown,
  TMiddlewares = undefined,
  TInputValidator = undefined,
>(
  options?: ServerFnOptions<TMethod, TStrict>,
  __opts?: ServerFnBaseOptions<
    TRegister,
    TMethod,
    TResponse,
    TMiddlewares,
    TInputValidator,
    TStrict
  >,
) => ServerFnBuilder<TRegister, TMethod, TStrict>

export const createServerFn: CreateServerFn<Register> = (options, __opts) => {
  const resolvedOptions = (__opts || options || {}) as ServerFnBaseOptions<
    any,
    any,
    any,
    any,
    any,
    any
  >

  if (typeof resolvedOptions.method === 'undefined') {
    resolvedOptions.method = 'GET' as Method
  }

  const setValidator = (validator: any) => {
    // TODO remove upon stable
    const newOptions = {
      ...resolvedOptions,
      validator,
      inputValidator: validator,
    }
    return createServerFn(undefined, newOptions) as any
  }

  const res: ServerFnBuilder<Register, Method, ServerFnStrict> = {
    options: resolvedOptions,
    middleware: (middleware) => {
      // multiple calls to `middleware()` merge the middlewares with the previously supplied ones
      // this is primarily useful for letting users create their own abstractions on top of `createServerFn`

      const newMiddleware = [...(resolvedOptions.middleware || [])]
      middleware.map((m) => {
        if (TSS_SERVER_FUNCTION_FACTORY in m) {
          if (m.options.middleware) {
            newMiddleware.push(...m.options.middleware)
          }
        } else {
          newMiddleware.push(m)
        }
      })

      const newOptions = {
        ...resolvedOptions,
        middleware: newMiddleware,
      }
      const res = createServerFn(undefined, newOptions)
      res[TSS_SERVER_FUNCTION_FACTORY] = true
      return res
    },
    validator: setValidator,
    // TODO remove upon stable
    inputValidator: setValidator,
    handler: (...args) => {
      // This function signature changes due to AST transformations
      // in the babel plugin. We need to cast it to the correct
      // function signature post-transformation
      const [extractedFn, serverFn] = args as unknown as [
        CompiledFetcherFn<Register, any>,
        ServerFn<Register, Method, any, any, any>,
      ]

      // Keep the original function around so we can use it
      // in the server environment
      const newOptions = { ...resolvedOptions, extractedFn, serverFn }

      const resolvedMiddleware = [
        ...(newOptions.middleware || []),
        serverFnBaseToMiddleware(newOptions),
      ]

      // We want to make sure the new function has the same
      // properties as the original function

      // Propagate the declared HTTP method onto the extracted handler
      // so the manifest-exported symbol (resolved by getServerFnById)
      // carries `method`, enabling the server handler to reject
      // mismatched HTTP methods before parsing request payloads.
      ;(extractedFn as any).method = resolvedOptions.method

      return Object.assign(
        async (opts?: CompiledFetcherFnOptions) => {
          // Start by executing the client-side middleware chain
          const result = await executeMiddleware(resolvedMiddleware, 'client', {
            ...extractedFn,
            ...newOptions,
            data: opts?.data,
            headers: opts?.headers,
            signal: opts?.signal,
            fetch: opts?.fetch,
            context: createNullProtoObject(),
          })

          const redirect = parseRedirect(result.error)
          if (redirect) {
            throw redirect
          }

          if (result.error) throw result.error
          return result.result
        },
        {
          // This copies over the URL, function ID
          ...extractedFn,
          // Expose the declared HTTP method so the server handler
          // can reject mismatched methods before parsing payloads
          method: resolvedOptions.method,
          // The extracted function on the server-side calls
          // this function
          __executeServer: async (opts: any) => {
            const startContext = getStartContextServerOnly()
            const serverContextAfterGlobalMiddlewares =
              startContext.contextAfterGlobalMiddlewares
            const ctx = {
              ...extractedFn,
              ...opts,
              // Ensure we use the full serverFnMeta from the provider file's extractedFn
              // (which has id, name, filename) rather than the partial one from SSR/client
              // callers (which only has id)
              serverFnMeta: extractedFn.serverFnMeta,
              // Merge client context first so trusted server middleware context wins.
              context: safeObjectMerge(
                opts.context,
                serverContextAfterGlobalMiddlewares,
              ),
              request: startContext.request,
            }

            const result = await executeMiddleware(
              resolvedMiddleware,
              'server',
              ctx,
            ).then((d) => ({
              // Only send the result and sendContext back to the client
              result: d.result,
              error: d.error,
              context: d.sendContext,
            }))

            return result
          },
        },
      ) as any
    },
  } as ServerFnBuilder<Register, Method, ServerFnStrict>
  const fun = (options?: ServerFnOptions<Method, ServerFnStrict>) => {
    const newOptions = {
      ...resolvedOptions,
      ...options,
    }
    return createServerFn(undefined, newOptions)
  }
  return Object.assign(fun, res) as any
}

export async function executeMiddleware(
  middlewares: Array<AnyFunctionMiddleware | AnyRequestMiddleware>,
  env: 'client' | 'server',
  opts: ServerFnMiddlewareOptions,
): Promise<ServerFnMiddlewareResult> {
  const globalMiddlewares = getStartOptions()?.functionMiddleware || []
  let flattenedMiddlewares = flattenMiddlewares([
    ...globalMiddlewares,
    ...middlewares,
  ])

  // On server, filter out middlewares that already executed in the request phase
  // to prevent duplicate execution (issue #5239)
  if (env === 'server') {
    const startContext = getStartContextServerOnly({ throwIfNotFound: false })
    if (startContext?.executedRequestMiddlewares) {
      flattenedMiddlewares = flattenedMiddlewares.filter(
        (m) => !startContext.executedRequestMiddlewares.has(m),
      )
    }
  }

  const callNextMiddleware: NextFn = async (ctx) => {
    // Get the next middleware
    const nextMiddleware = flattenedMiddlewares.shift()

    // If there are no more middlewares, return the context
    if (!nextMiddleware) {
      return ctx
    }

    // Execute the middleware
    try {
      let validator =
        'validator' in nextMiddleware.options
          ? nextMiddleware.options.validator
          : undefined

      // TODO remove upon stable
      if (!validator && 'inputValidator' in nextMiddleware.options) {
        validator = nextMiddleware.options.inputValidator
      }

      if (validator && env === 'server') {
        // Execute the middleware's input function
        ctx.data = await execValidator(validator as AnyValidator, ctx.data)
      }

      let middlewareFn: MiddlewareFn | undefined = undefined
      if (env === 'client') {
        if ('client' in nextMiddleware.options) {
          middlewareFn = nextMiddleware.options.client as
            | MiddlewareFn
            | undefined
        }
      }
      // env === 'server'
      else if ('server' in nextMiddleware.options) {
        middlewareFn = nextMiddleware.options.server as MiddlewareFn | undefined
      }

      if (middlewareFn) {
        const userNext = async (
          userCtx: ServerFnMiddlewareResult | undefined = {} as any,
        ) => {
          // Return the next middleware
          // Use safeObjectMerge for context objects to prevent prototype pollution
          const nextCtx = {
            ...ctx,
            ...userCtx,
            context: safeObjectMerge(ctx.context, userCtx.context),
            sendContext: safeObjectMerge(ctx.sendContext, userCtx.sendContext),
            headers: mergeHeaders(ctx.headers, userCtx.headers),
            _callSiteFetch: ctx._callSiteFetch,
            fetch: ctx._callSiteFetch ?? userCtx.fetch ?? ctx.fetch,
            result:
              userCtx.result !== undefined
                ? userCtx.result
                : userCtx instanceof Response
                  ? userCtx
                  : (ctx as any).result,
            error: userCtx.error ?? (ctx as any).error,
          }

          const result = await callNextMiddleware(nextCtx)

          if (result.error) {
            throw result.error
          }

          return result
        }

        // Execute the middleware
        const result = await middlewareFn({
          ...ctx,
          next: userNext,
        })

        // If result is NOT a ctx object, we need to return it as
        // the { result }
        if (isRedirect(result)) {
          return {
            ...ctx,
            error: result,
          }
        }

        if (result instanceof Response) {
          return {
            ...ctx,
            result,
          }
        }

        if (!(result as any)) {
          throw new Error(
            'User middleware returned undefined. You must call next() or return a result in your middlewares.',
          )
        }

        return result
      }

      return callNextMiddleware(ctx)
    } catch (error: any) {
      return {
        ...ctx,
        error,
      }
    }
  }

  // Start the middleware chain
  return callNextMiddleware({
    ...opts,
    headers: opts.headers || {},
    sendContext: opts.sendContext || {},
    context: opts.context || createNullProtoObject(),
    _callSiteFetch: opts.fetch,
  })
}

export type CompiledFetcherFnOptions = {
  method: Method
  data: unknown
  headers?: HeadersInit
  signal?: AbortSignal
  fetch?: CustomFetch
  context?: any
}

export type Fetcher<TMiddlewares, TInputValidator, TResponse> =
  undefined extends IntersectAllValidatorInputs<TMiddlewares, TInputValidator>
    ? OptionalFetcher<TMiddlewares, TInputValidator, TResponse>
    : RequiredFetcher<TMiddlewares, TInputValidator, TResponse>

export interface FetcherBase {
  [TSS_SERVER_FUNCTION]: true
  url: string
  method: Method
  __executeServer: (opts: {
    method: Method
    data: unknown
    headers?: HeadersInit
    context?: any
  }) => Promise<unknown>
}

export interface OptionalFetcher<
  TMiddlewares,
  TInputValidator,
  TResponse,
> extends FetcherBase {
  (
    options?: OptionalFetcherDataOptions<TMiddlewares, TInputValidator>,
  ): Promise<Awaited<TResponse>>
}

export interface RequiredFetcher<
  TMiddlewares,
  TInputValidator,
  TResponse,
> extends FetcherBase {
  (
    opts: RequiredFetcherDataOptions<TMiddlewares, TInputValidator>,
  ): Promise<Awaited<TResponse>>
}

// Ideally, this type should just be `export type CustomFetch = typeof globalThis.fetch`, but that conflicts with the type overrides the `bun-types` package - a dependency of unplugin.
// Relevant bun issues:
// - https://github.com/oven-sh/bun/issues/23500
// - https://github.com/oven-sh/bun/issues/23741
export type CustomFetch = typeof fetch extends (...args: infer A) => infer R
  ? (...args: A) => R
  : never

export type FetcherBaseOptions = {
  headers?: HeadersInit
  signal?: AbortSignal
  fetch?: CustomFetch
}

export interface OptionalFetcherDataOptions<
  TMiddlewares,
  TInputValidator,
> extends FetcherBaseOptions {
  data?: Expand<IntersectAllValidatorInputs<TMiddlewares, TInputValidator>>
}

export interface RequiredFetcherDataOptions<
  TMiddlewares,
  TInputValidator,
> extends FetcherBaseOptions {
  data: Expand<IntersectAllValidatorInputs<TMiddlewares, TInputValidator>>
}

export type RscStream<T> = {
  __cacheState: T
}

export type Method = 'GET' | 'POST'

export type ServerFnReturnType<
  TRegister,
  TResponse,
  TStrict extends ServerFnStrict = true,
> =
  ServerFnStrictOutput<TStrict> extends false
    ? TResponse
    : TResponse extends PromiseLike<infer U>
      ? Promise<ServerFnReturnType<TRegister, U, TStrict>>
      : TResponse extends Response
        ? TResponse
        : ValidateSerializableInput<TRegister, TResponse>

export type ServerFn<
  TRegister,
  TMethod,
  TMiddlewares,
  TInputValidator,
  TResponse,
  TStrict extends ServerFnStrict = true,
> = (
  ctx: ServerFnCtx<TRegister, TMethod, TMiddlewares, TInputValidator>,
) => ServerFnReturnType<TRegister, TResponse, TStrict>

export interface ServerFnCtx<
  TRegister,
  TMethod,
  TMiddlewares,
  TInputValidator,
> {
  data: Expand<IntersectAllValidatorOutputs<TMiddlewares, TInputValidator>>
  serverFnMeta: ServerFnMeta
  context: Expand<AssignAllServerFnContext<TRegister, TMiddlewares, {}>>
  method: TMethod
}

export type CompiledFetcherFn<TRegister, TResponse> = {
  (
    opts: CompiledFetcherFnOptions & ServerFnBaseOptions<TRegister, Method>,
  ): Promise<TResponse>
  url: string
  serverFnMeta: ServerFnMeta
}

export type ServerFnBaseOptions<
  TRegister,
  TMethod extends Method = 'GET',
  TResponse = unknown,
  TMiddlewares = unknown,
  TInputValidator = unknown,
  TStrict extends ServerFnStrict = true,
> = {
  method: TMethod
  strict?: TStrict
  middleware?: Constrain<
    TMiddlewares,
    ReadonlyArray<AnyFunctionMiddleware | AnyRequestMiddleware>
  >
  validator?: ConstrainValidator<TRegister, TMethod, TInputValidator, TStrict>
  // TODO remove upon stable
  /** @deprecated Use `validator` instead. */
  inputValidator?: ConstrainValidator<
    TRegister,
    TMethod,
    TInputValidator,
    TStrict
  >
  extractedFn?: CompiledFetcherFn<TRegister, TResponse>
  serverFn?: ServerFn<
    TRegister,
    TMethod,
    TMiddlewares,
    TInputValidator,
    TResponse,
    TStrict
  >
}

export type ValidateValidatorInput<
  TRegister,
  TMethod extends Method,
  TInputValidator,
  TStrict extends ServerFnStrict = true,
> =
  ServerFnStrictInput<TStrict> extends false
    ? ResolveValidatorInput<TInputValidator>
    : TMethod extends 'POST'
      ? ResolveValidatorInput<TInputValidator> extends FormData
        ? ResolveValidatorInput<TInputValidator>
        : ValidateSerializable<
            ResolveValidatorInput<TInputValidator>,
            RegisteredSerializableInput<TRegister>
          >
      : ValidateSerializable<
          ResolveValidatorInput<TInputValidator>,
          RegisteredSerializableInput<TRegister>
        >

export type ValidateValidator<
  TRegister,
  TMethod extends Method,
  TInputValidator,
  TStrict extends ServerFnStrict = true,
> =
  ValidateValidatorInput<
    TRegister,
    TMethod,
    TInputValidator,
    TStrict
  > extends infer TInput
    ? Validator<TInput, any>
    : never

export type ConstrainValidator<
  TRegister,
  TMethod extends Method,
  TInputValidator,
  TStrict extends ServerFnStrict = true,
> =
  | (unknown extends TInputValidator
      ? TInputValidator
      : ResolveValidatorInput<TInputValidator> extends ValidateValidator<
            TRegister,
            TMethod,
            TInputValidator,
            TStrict
          >
        ? TInputValidator
        : never)
  | ValidateValidator<TRegister, TMethod, TInputValidator, TStrict>

export type AppendMiddlewares<TMiddlewares, TNewMiddlewares> =
  TMiddlewares extends ReadonlyArray<any>
    ? TNewMiddlewares extends ReadonlyArray<any>
      ? readonly [...TMiddlewares, ...TNewMiddlewares]
      : TMiddlewares
    : TNewMiddlewares

export interface ServerFnMiddleware<
  TRegister,
  TMethod extends Method,
  TMiddlewares,
  TInputValidator,
  TStrict extends ServerFnStrict,
> {
  middleware: <const TNewMiddlewares>(
    middlewares: Constrain<
      TNewMiddlewares,
      ReadonlyArray<AnyFunctionMiddleware | AnyRequestMiddleware | AnyServerFn>
    >,
  ) => ServerFnAfterMiddleware<
    TRegister,
    TMethod,
    AppendMiddlewares<TMiddlewares, TNewMiddlewares>,
    TInputValidator,
    TStrict
  >
}

export interface ServerFnAfterMiddleware<
  TRegister,
  TMethod extends Method,
  TMiddlewares,
  TInputValidator,
  TStrict extends ServerFnStrict,
>
  extends
    ServerFnWithTypes<
      TRegister,
      TMethod,
      TMiddlewares,
      TInputValidator,
      undefined,
      TStrict
    >,
    ServerFnMiddleware<TRegister, TMethod, TMiddlewares, undefined, TStrict>,
    ServerFnValidator<TRegister, TMethod, TMiddlewares, TStrict>,
    ServerFnHandler<
      TRegister,
      TMethod,
      TMiddlewares,
      TInputValidator,
      TStrict
    > {
  <
    TNewMethod extends Method = TMethod,
    TNewStrict extends ServerFnStrict = TStrict,
  >(
    options?: ServerFnOptions<TNewMethod, TNewStrict>,
  ): ServerFnAfterMiddleware<
    TRegister,
    TNewMethod,
    TMiddlewares,
    TInputValidator,
    TNewStrict
  >
}

export type ValidatorFn<
  TRegister,
  TMethod extends Method,
  TMiddlewares,
  TStrict extends ServerFnStrict,
> = <TInputValidator>(
  validator: ConstrainValidator<TRegister, TMethod, TInputValidator, TStrict>,
) => ServerFnAfterValidator<
  TRegister,
  TMethod,
  TMiddlewares,
  TInputValidator,
  TStrict
>

export interface ServerFnValidator<
  TRegister,
  TMethod extends Method,
  TMiddlewares,
  TStrict extends ServerFnStrict,
> {
  validator: ValidatorFn<TRegister, TMethod, TMiddlewares, TStrict>
  // TODO remove upon stable
  /** @deprecated Use `validator` instead. */
  inputValidator: ValidatorFn<TRegister, TMethod, TMiddlewares, TStrict>
}

export interface ServerFnAfterValidator<
  TRegister,
  TMethod extends Method,
  TMiddlewares,
  TInputValidator,
  TStrict extends ServerFnStrict,
>
  extends
    ServerFnWithTypes<
      TRegister,
      TMethod,
      TMiddlewares,
      TInputValidator,
      undefined,
      TStrict
    >,
    ServerFnMiddleware<
      TRegister,
      TMethod,
      TMiddlewares,
      TInputValidator,
      TStrict
    >,
    ServerFnHandler<
      TRegister,
      TMethod,
      TMiddlewares,
      TInputValidator,
      TStrict
    > {}

export interface ServerFnAfterTyper<
  TRegister,
  TMethod extends Method,
  TMiddlewares,
  TInputValidator,
  TStrict extends ServerFnStrict,
>
  extends
    ServerFnWithTypes<
      TRegister,
      TMethod,
      TMiddlewares,
      TInputValidator,
      undefined,
      TStrict
    >,
    ServerFnHandler<
      TRegister,
      TMethod,
      TMiddlewares,
      TInputValidator,
      TStrict
    > {}

// Handler
export interface ServerFnHandler<
  TRegister,
  TMethod extends Method,
  TMiddlewares,
  TInputValidator,
  TStrict extends ServerFnStrict,
> {
  handler: <TNewResponse>(
    fn?: ServerFn<
      TRegister,
      TMethod,
      TMiddlewares,
      TInputValidator,
      TNewResponse,
      TStrict
    >,
  ) => Fetcher<TMiddlewares, TInputValidator, TNewResponse>
}

export interface ServerFnBuilder<
  TRegister,
  TMethod extends Method = 'GET',
  TStrict extends ServerFnStrict = true,
>
  extends
    ServerFnWithTypes<
      TRegister,
      TMethod,
      undefined,
      undefined,
      undefined,
      TStrict
    >,
    ServerFnMiddleware<TRegister, TMethod, undefined, undefined, TStrict>,
    ServerFnValidator<TRegister, TMethod, undefined, TStrict>,
    ServerFnHandler<TRegister, TMethod, undefined, undefined, TStrict> {
  <
    TNewMethod extends Method = TMethod,
    TNewStrict extends ServerFnStrict = TStrict,
  >(
    options?: ServerFnOptions<TNewMethod, TNewStrict>,
  ): ServerFnBuilder<TRegister, TNewMethod, TNewStrict>
  options: ServerFnBaseOptions<
    TRegister,
    TMethod,
    unknown,
    undefined,
    undefined,
    TStrict
  >
}

export interface ServerFnWithTypes<
  in out TRegister,
  in out TMethod extends Method,
  in out TMiddlewares,
  in out TInputValidator,
  in out TResponse,
  in out TStrict extends ServerFnStrict,
> {
  '~types': ServerFnTypes<
    TRegister,
    TMethod,
    TMiddlewares,
    TInputValidator,
    TResponse,
    TStrict
  >
  options: ServerFnBaseOptions<
    TRegister,
    TMethod,
    unknown,
    undefined,
    undefined,
    TStrict
  >
  [TSS_SERVER_FUNCTION_FACTORY]: true
}

export type AnyServerFn = ServerFnWithTypes<any, any, any, any, any, any>

export interface ServerFnTypes<
  in out TRegister,
  in out TMethod extends Method,
  in out TMiddlewares,
  in out TInputValidator,
  in out TResponse,
  in out TStrict extends ServerFnStrict,
> {
  method: TMethod
  strict: TStrict
  middlewares: TMiddlewares
  validator: TInputValidator
  // TODO remove upon stable
  /** @deprecated Use `validator` instead. */
  inputValidator: TInputValidator
  response: TResponse
  allServerContext: AssignAllServerFnContext<TRegister, TMiddlewares>
  allInput: IntersectAllValidatorInputs<TMiddlewares, TInputValidator>
  allOutput: IntersectAllValidatorOutputs<TMiddlewares, TInputValidator>
}

export function flattenMiddlewares<
  T extends AnyFunctionMiddleware | AnyRequestMiddleware,
>(middlewares: Array<T>, maxDepth: number = 100): Array<T> {
  const seen = new Set<T>()
  const flattened: Array<T> = []

  const recurse = (middleware: Array<T>, depth: number) => {
    if (depth > maxDepth) {
      throw new Error(
        `Middleware nesting depth exceeded maximum of ${maxDepth}. Check for circular references.`,
      )
    }
    middleware.forEach((m) => {
      if (m.options.middleware) {
        recurse(m.options.middleware as Array<T>, depth + 1)
      }

      if (!seen.has(m)) {
        seen.add(m)
        flattened.push(m)
      }
    })
  }

  recurse(middlewares, 0)

  return flattened
}

export type ServerFnMiddlewareOptions = {
  method: Method
  data: any
  headers?: HeadersInit
  signal?: AbortSignal
  sendContext?: any
  context?: any
  serverFnMeta: ClientFnMeta
  fetch?: CustomFetch
  /** @internal - Preserves the call-site fetch to ensure it has highest priority over middleware */
  _callSiteFetch?: CustomFetch
}

export type ServerFnMiddlewareResult = ServerFnMiddlewareOptions & {
  result?: unknown
  error?: unknown
}

export type NextFn = (
  ctx: ServerFnMiddlewareResult,
) => Promise<ServerFnMiddlewareResult>

export type MiddlewareFn = (
  ctx: ServerFnMiddlewareOptions & {
    next: NextFn
  },
) => Promise<ServerFnMiddlewareResult>

export async function execValidator(
  validator: AnyValidator,
  input: unknown,
): Promise<unknown> {
  if (validator == null) return {}

  if ('~standard' in validator) {
    const result = await validator['~standard'].validate(input)

    if (result.issues)
      throw new Error(JSON.stringify(result.issues, undefined, 2))

    return result.value
  }

  if ('parse' in validator) {
    return validator.parse(input)
  }

  if (typeof validator === 'function') {
    return validator(input)
  }

  throw new Error('Invalid validator type!')
}

function serverFnBaseToMiddleware(
  options: ServerFnBaseOptions<any, any, any, any, any>,
): AnyFunctionMiddleware {
  // TODO remove upon stable
  const validator = options.validator ?? options.inputValidator

  return {
    '~types': undefined!,
    options: {
      // TODO remove upon stable
      inputValidator: validator,
      client: async ({ next, sendContext, fetch, ...ctx }) => {
        const payload = {
          ...ctx,
          // switch the sendContext over to context
          context: sendContext,
          fetch,
        }

        // Execute the extracted function
        // but not before serializing the context
        const res = await options.extractedFn?.(payload)

        return next(res)
      },
      server: async ({ next, ...ctx }) => {
        // Execute the server function
        const result = await options.serverFn?.(ctx)

        return next({
          ...ctx,
          result,
        } as any)
      },
    },
  }
}
