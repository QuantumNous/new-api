// a function that can have different implementations on the client and server.
// implementations not provided will default to a no-op function.

export type IsomorphicFn<
  TArgs extends Array<any> = [],
  TServer = undefined,
  TClient = undefined,
> = (...args: TArgs) => TServer | TClient

export interface ServerOnlyFn<
  TArgs extends Array<any>,
  TServer,
> extends IsomorphicFn<TArgs, TServer> {
  client: <TClient>(
    clientImpl: (...args: TArgs) => TClient,
  ) => IsomorphicFn<TArgs, TServer, TClient>
}

export interface ClientOnlyFn<
  TArgs extends Array<any>,
  TClient,
> extends IsomorphicFn<TArgs, undefined, TClient> {
  server: <TServer>(
    serverImpl: (...args: TArgs) => TServer,
  ) => IsomorphicFn<TArgs, TServer, TClient>
}

export interface IsomorphicFnBase {
  server: <TArgs extends Array<any>, TServer>(
    serverImpl: (...args: TArgs) => TServer,
  ) => ServerOnlyFn<TArgs, TServer>
  client: <TArgs extends Array<any>, TClient>(
    clientImpl: (...args: TArgs) => TClient,
  ) => ClientOnlyFn<TArgs, TClient>
}

// The Start compiler normally rewrites createIsomorphicFn() chains before they
// run. Some package tests/build steps execute this stub uncompiled though, for
// example while Vite loads server-side modules during a build.
//
// In those uncompiled contexts we need a real callable fallback, not just a
// chain-shaped object. These contexts are server-side, so once a .server()
// implementation is registered we keep using it even if .client() is chained
// later. Client bundles still get the correct client/no-op implementation
// because the compiler rewrites the original call chain before runtime.
export function createIsomorphicFn(): IsomorphicFnBase {
  return createRuntimeFn(() => undefined) as any
}

type RuntimeFallbackFn = (() => any) & {
  server: (serverImpl: () => any) => RuntimeFallbackFn
  client: (clientImpl: () => any) => RuntimeFallbackFn
}

function createRuntimeFn(
  fn: () => any,
  serverImpl?: () => any,
): RuntimeFallbackFn {
  return Object.assign(fn, {
    server: (nextServerImpl: () => any) => {
      return createRuntimeFn(nextServerImpl, nextServerImpl)
    },
    client: (clientImpl: () => any) => {
      return createRuntimeFn(serverImpl ?? clientImpl, serverImpl)
    },
  })
}
