import { ReadableStream as NodeReadableStream } from 'node:stream/web'
import * as Vue from 'vue'
import { pipeToWebWritable, renderToString } from 'vue/server-renderer'
import { isbot } from 'isbot'
import {
  createSsrStreamResponse,
  transformReadableStreamWithRouter,
} from '@tanstack/router-core/ssr/server'
import type { AnyRouter } from '@tanstack/router-core'
import type { Component } from 'vue'

const isAbortError = (request: Request, error: unknown) =>
  (request.signal.aborted && error === request.signal.reason) ||
  (error instanceof Error && error.name === 'AbortError') ||
  (error as any)?.code === 'ABORT_ERR'

function prependDoctype(
  readable: globalThis.ReadableStream,
): NodeReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let sentDoctype = false
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const releaseReader = () => {
    try {
      reader?.releaseLock()
    } catch {
      // ignore
    }
    reader = undefined
  }

  return new NodeReadableStream<Uint8Array>({
    start() {
      reader = readable.getReader()
    },
    async pull(controller) {
      if (!sentDoctype) {
        sentDoctype = true
        controller.enqueue(encoder.encode('<!DOCTYPE html>'))
        return
      }
      try {
        const { done, value } = await reader!.read()
        if (done) {
          controller.close()
          releaseReader()
          return
        }
        controller.enqueue(value)
      } catch (err) {
        controller.error(err)
        releaseReader()
      }
    },
    async cancel(reason) {
      try {
        await reader?.cancel(reason)
      } catch {
        // ignore
      }
      releaseReader()
    },
  })
}

export const renderRouterToStream = async ({
  request,
  router,
  responseHeaders,
  App,
}: {
  request: Request
  router: AnyRouter
  responseHeaders: Headers
  App: Component
}) => {
  const app = Vue.createSSRApp(App, { router })

  if (isbot(request.headers.get('User-Agent'))) {
    try {
      let cleanupAbortListener: (() => void) | undefined
      const abortPromise = new Promise<never>((_, reject) => {
        if (request.signal.aborted) {
          reject(request.signal.reason)
          return
        }
        const onRequestAbort = () => reject(request.signal.reason)
        request.signal.addEventListener('abort', onRequestAbort, { once: true })
        cleanupAbortListener = () => {
          request.signal.removeEventListener('abort', onRequestAbort)
        }
      })

      let fullHtml = await Promise.race([
        renderToString(app),
        abortPromise,
      ]).finally(() => cleanupAbortListener?.())

      router.serverSsr!.setRenderFinished()
      const injectedHtml = router.serverSsr!.takeBufferedHtml()
      if (injectedHtml) {
        fullHtml = fullHtml.replace(`</body>`, () => `${injectedHtml}</body>`)
      }

      const htmlOpenIndex = fullHtml.indexOf('<html')
      const htmlCloseIndex = fullHtml.indexOf('</html>')

      if (htmlOpenIndex !== -1 && htmlCloseIndex !== -1) {
        fullHtml = fullHtml.slice(htmlOpenIndex, htmlCloseIndex + 7)
      } else if (htmlOpenIndex !== -1) {
        fullHtml = fullHtml.slice(htmlOpenIndex)
      }

      return new Response(`<!DOCTYPE html>${fullHtml}`, {
        status: router.stores.statusCode.get(),
        headers: responseHeaders,
      })
    } finally {
      router.serverSsr?.cleanup()
    }
  }

  const { writable, readable } = new TransformStream()
  const innerWriter = writable.getWriter()
  let writerDone = false
  const releaseWriter = () => {
    try {
      innerWriter.releaseLock()
    } catch {
      // already released / errored
    }
  }
  const abortVuePipe = (reason?: unknown) => {
    if (writerDone) {
      return
    }

    writerDone = true
    void innerWriter
      .abort(reason)
      .catch(() => {})
      .finally(releaseWriter)
  }
  const handleWriterError = (err: unknown) => {
    if (isAbortError(request, err)) {
      return
    }

    throw err
  }
  const handleWriteError = (err: unknown) => {
    if (writerDone || isAbortError(request, err)) {
      return
    }

    throw err
  }

  const vueWritable = new WritableStream({
    write(chunk) {
      if (writerDone) {
        return
      }

      return innerWriter.write(chunk).catch(handleWriteError)
    },
    close() {
      if (writerDone) {
        return
      }

      writerDone = true
      return innerWriter.close().catch(handleWriterError).finally(releaseWriter)
    },
    abort(reason) {
      if (writerDone) {
        return
      }

      writerDone = true
      return innerWriter
        .abort(reason)
        .catch(handleWriterError)
        .finally(releaseWriter)
    },
  })

  // `pipeToWebWritable` returns void (see @vue/server-renderer). Pass a
  // proxy writable so request aborts can abort the real TransformStream
  // writer even while Vue holds a lock on the proxy writable.
  try {
    pipeToWebWritable(app, {}, vueWritable)
  } catch (err) {
    console.error('Error in Vue pipeToWebWritable:', err)
    // Setup failed before any pipe was wired; abort writable so the
    // readable side errors instead of hanging until the lifetime timeout.
    abortVuePipe(err)
  }

  if (request.signal.aborted) {
    abortVuePipe(request.signal.reason)
  } else {
    const onRequestAbort = () => abortVuePipe(request.signal.reason)
    request.signal.addEventListener('abort', onRequestAbort, { once: true })
    router.serverSsr?.onCleanup(() => {
      request.signal.removeEventListener('abort', onRequestAbort)
    })
  }

  const doctypedStream = prependDoctype(readable)
  const responseStream = transformReadableStreamWithRouter(
    router,
    doctypedStream,
    { onAbort: abortVuePipe },
  )

  return createSsrStreamResponse(
    router,
    new Response(responseStream as any, {
      status: router.stores.statusCode.get(),
      headers: responseHeaders,
    }),
  )
}
