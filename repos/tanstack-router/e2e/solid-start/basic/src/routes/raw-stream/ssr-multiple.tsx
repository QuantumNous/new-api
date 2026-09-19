import { createFileRoute } from '@tanstack/solid-router'
import { RawStream } from '@tanstack/solid-start'
import { createEffect, createSignal } from 'solid-js'
import {
  createDelayedStream,
  createStreamConsumer,
  encode,
} from '../../raw-stream-fns'

function SSRMultipleTest() {
  const loaderData = Route.useLoaderData()
  const [firstContent, setFirstContent] = createSignal('')
  const [secondContent, setSecondContent] = createSignal('')
  const [isConsuming, setIsConsuming] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  createEffect(() => {
    const first = loaderData().first
    const second = loaderData().second
    if (!first || !second) {
      return
    }
    const consumeStream = createStreamConsumer()
    setIsConsuming(true)
    setError(null)
    Promise.all([consumeStream(first), consumeStream(second)])
      .then(([content1, content2]) => {
        setFirstContent(content1)
        setSecondContent(content2)
        setIsConsuming(false)
      })
      .catch((err) => {
        setError(String(err))
        setIsConsuming(false)
      })
  })

  return (
    <div class="space-y-4">
      <h2>SSR Multiple RawStreams Test</h2>
      <p class="text-gray-600">
        This route returns multiple RawStreams from its loader. Each stream is
        independently serialized during SSR.
      </p>

      <div class="border p-4 rounded">
        <div data-testid="ssr-multiple-message">
          Message: {loaderData().message}
        </div>
        <div data-testid="ssr-multiple-first">
          First Stream:
          {error()
            ? `Error: ${error()}`
            : isConsuming()
              ? 'Loading...'
              : firstContent()}
        </div>
        <div data-testid="ssr-multiple-second">
          Second Stream:
          {error()
            ? `Error: ${error()}`
            : isConsuming()
              ? 'Loading...'
              : secondContent()}
        </div>
        <pre data-testid="ssr-multiple-result">
          {JSON.stringify({
            message: loaderData().message,
            firstContent: firstContent(),
            secondContent: secondContent(),
            isConsuming: isConsuming(),
            error: error(),
          })}
        </pre>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/raw-stream/ssr-multiple')({
  loader: async () => {
    const stream1 = createDelayedStream(
      [encode('multi-1a'), encode('multi-1b')],
      30,
    )
    const stream2 = createDelayedStream(
      [encode('multi-2a'), encode('multi-2b')],
      50,
    )
    return {
      message: 'SSR Multiple Streams Test',
      first: new RawStream(stream1),
      second: new RawStream(stream2),
    }
  },
  component: SSRMultipleTest,
})
