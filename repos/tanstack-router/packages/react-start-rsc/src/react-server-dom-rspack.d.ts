/**
 * Type declarations for react-server-dom-rspack.
 *
 * This package ships no .d.ts files. Declarations here cover only the
 * subset of the API surface that TanStack Start uses.
 */

declare module 'react-server-dom-rspack/client.node' {
  export function createFromReadableStream<T = unknown>(
    stream: ReadableStream<Uint8Array>,
    options?: object,
  ): Promise<T>
}

declare module 'react-server-dom-rspack/client.browser' {
  export function createFromReadableStream<T = unknown>(
    stream: ReadableStream<Uint8Array>,
    options?: object,
  ): Promise<T>

  export function createFromFetch<T = unknown>(
    fetchPromise: Promise<Response>,
    options?: object,
  ): Promise<T>
}

declare module 'react-server-dom-rspack/server' {
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
