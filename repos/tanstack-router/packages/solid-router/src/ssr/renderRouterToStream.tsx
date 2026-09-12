import * as Solid from 'solid-js/web'
import { isbot } from 'isbot'
import {
  createSsrStreamResponse,
  transformReadableStreamWithRouter,
} from '@tanstack/router-core/ssr/server'
import { makeSsrSerovalPlugin } from '@tanstack/router-core'
import type { JSXElement } from 'solid-js'
import type { ReadableStream } from 'node:stream/web'
import type { AnyRouter } from '@tanstack/router-core'

const noop = () => {}

// Bot responses wait for the server renderer before streaming. If the request
// disconnects during that wait, unblock so the pipe can abort and clean up.
async function waitForReadyOrAbort(
  ready: Promise<unknown>,
  signal: AbortSignal,
) {
  let cleanup = noop
  try {
    await Promise.race([
      ready,
      new Promise<void>((resolve) => {
        const onAbort = () => resolve()
        cleanup = () => signal.removeEventListener('abort', onAbort)
        signal.addEventListener('abort', onAbort, { once: true })
        if (signal.aborted) resolve()
      }),
    ])
  } finally {
    cleanup()
  }
}

export const renderRouterToStream = async ({
  request,
  router,
  responseHeaders,
  children,
}: {
  request: Request
  router: AnyRouter
  responseHeaders: Headers
  children: () => JSXElement
}) => {
  const { writable, readable } = new TransformStream()

  const docType = Solid.ssr('<!DOCTYPE html>')

  const serializationAdapters =
    (router.options as any)?.serializationAdapters ||
    (router.options.ssr as any)?.serializationAdapters
  const serovalPlugins = serializationAdapters?.map((adapter: any) => {
    const plugin = makeSsrSerovalPlugin(adapter, { didRun: false })
    return plugin
  })

  const stream = Solid.renderToStream(
    () => (
      <>
        {docType}
        {children()}
      </>
    ),
    {
      nonce: router.options.ssr?.nonce,
      plugins: serovalPlugins,
    } as any,
  )

  // Solid's `pipeTo(w)` takes a single arg (no signal overload) and locks
  // `w` via `w.getWriter()`. To still own the lifecycle we hand Solid a
  // proxy WritableStream that forwards into an inner writer we control on
  // the real TransformStream writable. Aborting the inner writer errors
  // the underlying readable (which our router transform reads from),
  // surfacing the cancel through the response pipeline.
  //
  // RESIDUAL RISK: solid-js@1.x does NOT expose a disposal hook on
  // `renderToStream`, and its internal write loop swallows writer
  // rejections (`writer.write(...).catch(() => {})` in
  // solid-js/web/dist/server.js). So aborting the inner writer stops
  // outbound bytes but does not terminate Solid's render continuation
  // if a Suspense/resource never resolves — those pending promise
  // continuations remain scheduled and can retain children/context/
  // request references via captured closures until natural completion
  // or process exit. The request-scoped router graph itself is released
  // by ServerSsr.cleanup() through the router stream lifecycle, so the leak
  // is bounded to whatever the user's Suspense/resource closures capture.
  // A hard upstream-abort guarantee would require a disposal API in solid-js.
  const innerWriter = writable.getWriter()
  let writerDone = false
  const releaseWriter = () => {
    try {
      innerWriter.releaseLock()
    } catch {
      // already released / errored
    }
  }
  const abortSolidPipe = (reason?: unknown) => {
    if (writerDone) return
    writerDone = true
    void innerWriter
      .abort(reason)
      .catch(() => {})
      .finally(releaseWriter)
  }

  const onRequestAbort = () => {
    abortSolidPipe(request.signal.reason)
  }

  // Wire request abort before the bot all-ready wait. Otherwise a disconnect
  // during `await stream` can leave this callback pending forever.
  if (request.signal.aborted) {
    onRequestAbort()
  } else {
    request.signal.addEventListener('abort', onRequestAbort, { once: true })
    router.serverSsr?.onCleanup(() => {
      request.signal.removeEventListener('abort', onRequestAbort)
    })
  }

  if (isbot(request.headers.get('User-Agent'))) {
    await waitForReadyOrAbort(
      Promise.resolve(stream as unknown),
      request.signal,
    )
  }

  const solidWritable = new WritableStream({
    write(chunk) {
      return innerWriter.write(chunk)
    },
    close() {
      writerDone = true
      return innerWriter.close().finally(releaseWriter)
    },
    abort(reason) {
      writerDone = true
      return innerWriter.abort(reason).finally(releaseWriter)
    },
  })

  if (!request.signal.aborted) {
    try {
      void Promise.resolve(stream.pipeTo(solidWritable) as unknown).catch(
        (err: any) => {
          if (
            writerDone ||
            err?.name === 'AbortError' ||
            err?.code === 'ABORT_ERR'
          )
            return
          console.error('Error in Solid render stream:', err)
          abortSolidPipe(err)
        },
      )
    } catch (err: any) {
      if (err?.name !== 'AbortError' && err?.code !== 'ABORT_ERR') {
        console.error('Error in Solid render stream:', err)
      }
      abortSolidPipe(err)
    }
  }

  const responseStream = transformReadableStreamWithRouter(
    router,
    readable as unknown as ReadableStream,
    { onAbort: abortSolidPipe },
  )
  return createSsrStreamResponse(
    router,
    new Response(responseStream as any, {
      status: router.stores.statusCode.get(),
      headers: responseHeaders,
    }),
  )
}
