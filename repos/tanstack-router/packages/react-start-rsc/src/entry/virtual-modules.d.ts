// Type declarations for virtual modules used in RSC entry
// These modules are provided by the active bundler adapter at runtime

declare module '#tanstack-start-server-fn-resolver' {
  export type ServerFnLookupAccess = { origin: 'client' } | { origin: 'server' }

  export type ServerFn = (...args: Array<any>) => Promise<any>
  export function getServerFnById(
    id: string,
    access: ServerFnLookupAccess,
  ): Promise<ServerFn>
}
