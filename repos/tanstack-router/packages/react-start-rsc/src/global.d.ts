/// <reference types="vite/client" />

declare module '@rspack/core/rsc/ssr' {
  export function setOnClientReference(
    callback:
      | ((reference: {
          id: string
          deps: { js: Array<string>; css: Array<string> }
          runtime: 'rsbuild'
        }) => void)
      | null
      | undefined,
  ): void
  export function getManifest(): {
    moduleCssFiles?: Record<string, Array<string>>
    [key: string]: unknown
  }
}

declare module '@rspack/core/rsc/browser' {
  export function getManifest(): {
    moduleCssFiles?: Record<string, Array<string>>
    [key: string]: unknown
  }
}

/**
 * Type declarations for virtual:tanstack-rsc-runtime
 *
 * This virtual module is provided by the active Start bundler adapter
 * and re-exports RSC runtime functions from that adapter's Flight runtime.
 *
 * Using a virtual module allows the imports to be resolved at runtime within
 * the correct server environment context (react-server conditions).
 */
declare module 'virtual:tanstack-rsc-runtime' {
  export function renderToReadableStream<T>(
    data: T,
    options?: object,
  ): ReadableStream<Uint8Array>
  export function createFromReadableStream<T = unknown>(
    stream: ReadableStream<Uint8Array>,
    options?: object,
  ): Promise<T>
  export function createTemporaryReferenceSet(): object
  export function decodeReply<T = unknown>(
    body: string | FormData,
    options?: object,
  ): Promise<T>
  export function loadServerAction(id: string): Promise<(...args: any) => any>
  export function decodeAction<T = unknown>(
    body: FormData,
    serverManifest?: unknown,
  ): Promise<() => T>
  export function decodeFormState<T = unknown>(
    actionResult: T,
    body: FormData,
    serverManifest?: unknown,
  ): Promise<unknown>
}

declare module 'virtual:tanstack-rsc-browser-decode' {
  export function createFromReadableStream<T = unknown>(
    stream: ReadableStream<Uint8Array>,
    options?: object,
  ): Promise<T>
  export function createFromFetch<T = unknown>(
    response: Promise<Response>,
  ): Promise<T>
}

declare module 'virtual:tanstack-rsc-ssr-decode' {
  export function setOnClientReference(
    callback:
      | ((reference: {
          id: string
          deps: { js: Array<string>; css: Array<string> }
          runtime?: 'rsbuild'
        }) => void)
      | undefined,
  ): void
  export function createFromReadableStream<T = unknown>(
    stream: ReadableStream<Uint8Array>,
    options?: object,
  ): Promise<T>
}

/**
 * Type declarations for virtual:tanstack-rsc-hmr
 *
 * This virtual module is provided by the active Start bundler adapter
 * and sets up the RSC HMR listener in dev mode. It listens for 'rsc:update'
 * events and invalidates the router to refetch server components.
 *
 * In production builds, this module is empty.
 */
declare module 'virtual:tanstack-rsc-hmr' {
  export function setupRscHmr(): void
}
