import { createFileRoute } from '@tanstack/solid-router'
import { RawStream } from '@tanstack/solid-start'
import { createEffect, createSignal } from 'solid-js'
import {
  createDelayedStream,
  createStreamConsumer,
  encode,
} from '../../raw-stream-fns'

function SSRSingleTest() {
  const loaderData = Route.useLoaderData()
  const [streamContent, setStreamContent] = createSignal('')
  const [isConsuming, setIsConsuming] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  createEffect(() => {
    const rawData = loaderData().rawData
    if (!rawData) {
      return
    }
    const consumeStream = createStreamConsumer()
    setIsConsuming(true)
    setError(null)
    consumeStream(rawData)
      .then((content) => {
        setStreamContent(content)
        setIsConsuming(false)
      })
      .catch((err) => {
        setError(String(err))
        setIsConsuming(false)
      })
  })

  return (
    <div class="space-y-4">
      <h2>SSR Single RawStream Test</h2>
      <p class="text-gray-600">
        This route returns a single RawStream from its loader. The stream is
        serialized during SSR using base64 encoding.
      </p>

      <div class="border p-4 rounded">
        <div data-testid="ssr-single-message">
          Message: {loaderData().message}
        </div>
        <div data-testid="ssr-single-timestamp">
          Has Timestamp:{' '}
          {typeof loaderData().timestamp === 'number' ? 'true' : 'false'}
        </div>
        <div data-testid="ssr-single-stream">
          Stream Content:
          {error()
            ? `Error: ${error()}`
            : isConsuming()
              ? 'Loading...'
              : streamContent()}
        </div>
        <div data-testid="ssr-single-rawdata-type">
          RawData Type: {typeof loaderData().rawData} | hasStream:
          {loaderData().rawData && 'getReader' in loaderData().rawData
            ? 'true'
            : 'false'}
        </div>
        <pre data-testid="ssr-single-result">
          {JSON.stringify({
            message: loaderData().message,
            streamContent: streamContent(),
            isConsuming: isConsuming(),
            error: error(),
          })}
        </pre>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/raw-stream/ssr-single')({
  loader: async () => {
    const stream = createDelayedStream(
      [encode('ssr-chunk1'), encode('ssr-chunk2'), encode('ssr-chunk3')],
      50,
    )
    return {
      message: 'SSR Single Stream Test',
      timestamp: Date.now(),
      rawData: new RawStream(stream),
    }
  },
  component: SSRSingleTest,
})
