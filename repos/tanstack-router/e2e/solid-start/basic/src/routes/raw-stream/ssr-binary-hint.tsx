import { createFileRoute } from '@tanstack/solid-router'
import { RawStream } from '@tanstack/solid-start'
import { createEffect, createSignal } from 'solid-js'
import {
  collectBytes,
  compareBytes,
  concatBytes,
  createDelayedStream,
  encode,
} from '../../raw-stream-fns'

// Expected data - defined at module level for client-side verification
const TEXT_CHUNKS = [encode('Binary '), encode('hint '), encode('with text')]
const TEXT_EXPECTED = concatBytes(TEXT_CHUNKS)

const BINARY_CHUNKS = [
  new Uint8Array([0x00, 0x01, 0x02, 0x03]),
  new Uint8Array([0xff, 0xfe, 0xfd, 0xfc]),
]
const BINARY_EXPECTED = concatBytes(BINARY_CHUNKS)

type TextMatch = {
  match: boolean
  mismatchIndex: number | null
  actualLength: number
  expectedLength: number
  asText: string
}

type BinaryMatch = {
  match: boolean
  mismatchIndex: number | null
  actualLength: number
  expectedLength: number
}

function SSRBinaryHintTest() {
  const loaderData = Route.useLoaderData()
  const [textMatch, setTextMatch] = createSignal<TextMatch | null>(null)
  const [binaryMatch, setBinaryMatch] = createSignal<BinaryMatch | null>(null)
  const [isLoading, setIsLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  createEffect(() => {
    const { textData, binaryData } = loaderData()
    if (!textData || !binaryData) {
      return
    }
    setIsLoading(true)
    setError(null)
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
  })

  return (
    <div class="space-y-4">
      <h2>SSR Binary Hint Test</h2>
      <p class="text-gray-600">
        This route tests RawStream with hint: 'binary' from loader. Binary hint
        always uses base64 encoding (default behavior).
      </p>

      <div class="border p-4 rounded">
        <div data-testid="ssr-binary-hint-message">
          Message: {loaderData().message}
        </div>
        <div data-testid="ssr-binary-hint-text">
          Text Data:
          {error()
            ? `Error: ${error()}`
            : isLoading()
              ? 'Loading...'
              : textMatch()?.asText}
        </div>
        <div data-testid="ssr-binary-hint-text-match">
          Text Bytes Match:
          {isLoading() ? 'Loading...' : textMatch()?.match ? 'true' : 'false'}
        </div>
        <div data-testid="ssr-binary-hint-binary-match">
          Binary Bytes Match:
          {isLoading() ? 'Loading...' : binaryMatch()?.match ? 'true' : 'false'}
        </div>
        <pre data-testid="ssr-binary-hint-result">
          {JSON.stringify({
            message: loaderData().message,
            textMatch: textMatch(),
            binaryMatch: binaryMatch(),
            isLoading: isLoading(),
            error: error(),
          })}
        </pre>
      </div>
    </div>
  )
}

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
