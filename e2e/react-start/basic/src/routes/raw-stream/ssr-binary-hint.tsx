import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { RawStream } from '@tanstack/react-start'
import {
  encode,
  createDelayedStream,
  concatBytes,
  collectBytes,
  compareBytes,
} from '../../raw-stream-fns'

// Expected data - defined at module level for client-side verification
const TEXT_CHUNKS = [encode('Binary '), encode('hint '), encode('with text')]
const TEXT_EXPECTED = concatBytes(TEXT_CHUNKS)

const BINARY_CHUNKS = [
  new Uint8Array([0x00, 0x01, 0x02, 0x03]),
  new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]),
]
const BINARY_EXPECTED = concatBytes(BINARY_CHUNKS)

export const Route = createFileRoute('/raw-stream/ssr-binary-hint')({
  loader: async () => {
    // Text data with binary hint - should still use base64 (default behavior)
    const textStream = createDelayedStream(
      [encode('Binary '), encode('hint '), encode('with text')],
      30,
    )

    // Pure binary stream with binary hint
    const binaryStream = createDelayedStream(
      [
        new Uint8Array([0x00, 0x01, 0x02, 0x03]),
        new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]),
      ],
      30,
    )

    return {
      message: 'SSR Binary Hint Test',
      textData: new RawStream(textStream, { hint: 'binary' }),
      binaryData: new RawStream(binaryStream, { hint: 'binary' }),
    }
  },
  component: SSRBinaryHintTest,
})

function SSRBinaryHintTest() {
  const { message, textData, binaryData } = Route.useLoaderData()
  const [textMatch, setTextMatch] = React.useState<{
    match: boolean
    mismatchIndex: number | null
    actualLength: number
    expectedLength: number
    asText: string
  } | null>(null)
  const [binaryMatch, setBinaryMatch] = React.useState<{
    match: boolean
    mismatchIndex: number | null
    actualLength: number
    expectedLength: number
  } | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    Promise.all([collectBytes(textData), collectBytes(binaryData)])
      .then(([textBytes, binaryBytes]) => {
        const textComp = compareBytes(textBytes, TEXT_EXPECTED)
        const decoder = new TextDecoder()
        setTextMatch({
          ...textComp,
          actualLength: textBytes.length,
          expectedLength: TEXT_EXPECTED.length,
          asText: decoder.decode(textBytes),
        })
        const binaryComp = compareBytes(binaryBytes, BINARY_EXPECTED)
        setBinaryMatch({
          ...binaryComp,
          actualLength: binaryBytes.length,
          expectedLength: BINARY_EXPECTED.length,
        })
        setIsLoading(false)
      })
      .catch((err) => {
        setError(String(err))
        setIsLoading(false)
      })
  }, [textData, binaryData])

  return (
    <div className="space-y-4">
      <h2>SSR Binary Hint Test</h2>
      <p className="text-gray-600">
        This route tests RawStream with hint: 'binary' from loader. Binary hint
        always uses base64 encoding (default behavior).
      </p>

      <div className="border p-4 rounded">
        <div data-testid="ssr-binary-hint-message">Message: {message}</div>
        <div data-testid="ssr-binary-hint-text">
          Text Data:{' '}
          {error
            ? `Error: ${error}`
            : isLoading
              ? 'Loading...'
              : textMatch?.asText}
        </div>
        <div data-testid="ssr-binary-hint-text-match">
          Text Bytes Match:{' '}
          {isLoading ? 'Loading...' : textMatch?.match ? 'true' : 'false'}
        </div>
        <div data-testid="ssr-binary-hint-binary-match">
          Binary Bytes Match:{' '}
          {isLoading ? 'Loading...' : binaryMatch?.match ? 'true' : 'false'}
        </div>
        <pre data-testid="ssr-binary-hint-result">
          {JSON.stringify({
            message,
            textMatch,
            binaryMatch,
            isLoading,
            error,
          })}
        </pre>
      </div>
    </div>
  )
}
