import { Await, createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { RawStream } from '@tanstack/react-start'
import {
  createDelayedStream,
  createStreamConsumer,
  encode,
} from '../../raw-stream-fns'

export const Route = createFileRoute('/raw-stream/ssr-mixed')({
  loader: () => {
    const rawStream = createDelayedStream(
      [encode('mixed-ssr-1'), encode('mixed-ssr-2')],
      50,
    )

    // Deferred promise that resolves after a delay
    const deferredData = new Promise<string>((resolve) =>
      setTimeout(() => resolve('deferred-ssr-value'), 100),
    )

    return {
      immediate: 'immediate-ssr-value',
      deferred: deferredData,
      rawData: new RawStream(rawStream),
    }
  },
  component: SSRMixedTest,
})

function SSRMixedTest() {
  const { immediate, deferred, rawData } = Route.useLoaderData()
  const [streamContent, setStreamContent] = React.useState<string>('')
  const [isConsuming, setIsConsuming] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const consumeStream = createStreamConsumer()
    consumeStream(rawData)
      .then((content) => {
        setStreamContent(content)
        setIsConsuming(false)
      })
      .catch((err) => {
        setError(String(err))
        setIsConsuming(false)
      })
  }, [rawData])

  return (
    <div className="space-y-4">
      <h2>SSR Mixed Streaming Test</h2>
      <p className="text-gray-600">
        This route returns a mix of immediate data, deferred promises, and
        RawStream from its loader.
      </p>

      <div className="border p-4 rounded">
        <div data-testid="ssr-mixed-immediate">Immediate: {immediate}</div>
        <div data-testid="ssr-mixed-deferred">
          Deferred:{' '}
          <React.Suspense fallback="Loading deferred...">
            <Await promise={deferred}>{(value) => <span>{value}</span>}</Await>
          </React.Suspense>
        </div>
        <div data-testid="ssr-mixed-stream">
          Stream Content:{' '}
          {error
            ? `Error: ${error}`
            : isConsuming
              ? 'Loading...'
              : streamContent}
        </div>
        <pre data-testid="ssr-mixed-result">
          {JSON.stringify({ immediate, streamContent, isConsuming, error })}
        </pre>
      </div>
    </div>
  )
}
