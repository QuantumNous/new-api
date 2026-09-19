import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { RawStream } from '@tanstack/react-start'
import {
  encode,
  createDelayedStream,
  createStreamConsumer,
} from '../../raw-stream-fns'

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

function SSRMultipleTest() {
  const { message, first, second } = Route.useLoaderData()
  const [firstContent, setFirstContent] = React.useState<string>('')
  const [secondContent, setSecondContent] = React.useState<string>('')
  const [isConsuming, setIsConsuming] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const consumeStream = createStreamConsumer()
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
  }, [first, second])

  return (
    <div className="space-y-4">
      <h2>SSR Multiple RawStreams Test</h2>
      <p className="text-gray-600">
        This route returns multiple RawStreams from its loader. Each stream is
        independently serialized during SSR.
      </p>

      <div className="border p-4 rounded">
        <div data-testid="ssr-multiple-message">Message: {message}</div>
        <div data-testid="ssr-multiple-first">
          First Stream:{' '}
          {error
            ? `Error: ${error}`
            : isConsuming
              ? 'Loading...'
              : firstContent}
        </div>
        <div data-testid="ssr-multiple-second">
          Second Stream:{' '}
          {error
            ? `Error: ${error}`
            : isConsuming
              ? 'Loading...'
              : secondContent}
        </div>
        <pre data-testid="ssr-multiple-result">
          {JSON.stringify({
            message,
            firstContent,
            secondContent,
            isConsuming,
            error,
          })}
        </pre>
      </div>
    </div>
  )
}
