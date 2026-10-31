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
const PURE_TEXT_CHUNKS = [
  encode('Hello '),
  encode('World '),
  encode('from SSR!'),
]
const PURE_TEXT_EXPECTED = concatBytes(PURE_TEXT_CHUNKS)

const MIXED_CHUNKS = [
  encode('Valid text'),
  new Uint8Array([0xff, 0xfe, 0x80, 0x90]), // Invalid UTF-8
  encode(' more text'),
]
const MIXED_EXPECTED = concatBytes(MIXED_CHUNKS)

// Pure binary data (invalid UTF-8) - must use base64 fallback
const PURE_BINARY_CHUNKS = [
  new Uint8Array([0xff, 0xfe, 0x00, 0x01, 0x80, 0x90]),
  new Uint8Array([0xa0, 0xb0, 0xc0, 0xd0, 0xe0, 0xf0]),
]
const PURE_BINARY_EXPECTED = concatBytes(PURE_BINARY_CHUNKS)

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

function SSRTextHintTest() {
  const loaderData = Route.useLoaderData()
  const [pureTextMatch, setPureTextMatch] = createSignal<TextMatch | null>(null)
  const [mixedMatch, setMixedMatch] = createSignal<BinaryMatch | null>(null)
  const [pureBinaryMatch, setPureBinaryMatch] =
    createSignal<BinaryMatch | null>(null)
  const [isLoading, setIsLoading] = createSignal(true)
  const [error, setError] = createSignal<string | null>(null)

  createEffect(() => {
    const { pureText, mixedContent, pureBinary } = loaderData()
    if (!pureText || !mixedContent || !pureBinary) {
      return
    }
    setIsLoading(true)
    setError(null)
    Promise.all([
      collectBytes(pureText),
      collectBytes(mixedContent),
      collectBytes(pureBinary),
    ])
      .then(([pureBytes, mixedBytes, pureBinaryBytes]) => {
        const pureComp = compareBytes(pureBytes, PURE_TEXT_EXPECTED)
        const decoder = new TextDecoder()
        setPureTextMatch({
          ...pureComp,
          actualLength: pureBytes.length,
          expectedLength: PURE_TEXT_EXPECTED.length,
          asText: decoder.decode(pureBytes),
        })
        const mixedComp = compareBytes(mixedBytes, MIXED_EXPECTED)
        setMixedMatch({
          ...mixedComp,
          actualLength: mixedBytes.length,
          expectedLength: MIXED_EXPECTED.length,
        })
        const pureBinaryComp = compareBytes(
          pureBinaryBytes,
          PURE_BINARY_EXPECTED,
        )
        setPureBinaryMatch({
          ...pureBinaryComp,
          actualLength: pureBinaryBytes.length,
          expectedLength: PURE_BINARY_EXPECTED.length,
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
      <h2>SSR Text Hint Test</h2>
      <p class="text-gray-600">
        This route tests RawStream with hint: 'text' from loader. Text hint
        optimizes for UTF-8 content but falls back to base64 for invalid UTF-8.
      </p>

      <div class="border p-4 rounded">
        <div data-testid="ssr-text-hint-message">
          Message: {loaderData().message}
        </div>
        <div data-testid="ssr-text-hint-pure-text">
          Pure Text:
          {error()
            ? `Error: ${error()}`
            : isLoading()
              ? 'Loading...'
              : pureTextMatch()?.asText}
        </div>
        <div data-testid="ssr-text-hint-pure-match">
          Pure Text Bytes Match:
          {isLoading()
            ? 'Loading...'
            : pureTextMatch()?.match
              ? 'true'
              : 'false'}
        </div>
        <div data-testid="ssr-text-hint-mixed-match">
          Mixed Content Bytes Match:
          {isLoading() ? 'Loading...' : mixedMatch()?.match ? 'true' : 'false'}
        </div>
        <div data-testid="ssr-text-hint-pure-binary-match">
          Pure Binary Bytes Match:
          {isLoading()
            ? 'Loading...'
            : pureBinaryMatch()?.match
              ? 'true'
              : 'false'}
        </div>
        <pre data-testid="ssr-text-hint-result">
          {JSON.stringify({
            message: loaderData().message,
            pureTextMatch: pureTextMatch(),
            mixedMatch: mixedMatch(),
            pureBinaryMatch: pureBinaryMatch(),
            isLoading: isLoading(),
            error: error(),
          })}
        </pre>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/raw-stream/ssr-text-hint')({
  loader: async () => {
    // Pure text stream - should use UTF-8 encoding with text hint
    const textStream = createDelayedStream(
      [encode('Hello '), encode('World '), encode('from SSR!')],
      30,
    )

    // Mixed content stream - text hint should use UTF-8 for valid text, base64 for binary
    const mixedStream = createDelayedStream(
      [
        encode('Valid text'),
        new Uint8Array([0xff, 0xfe, 0x80, 0x90]), // Invalid UTF-8
        encode(' more text'),
      ],
      30,
    )

    // Pure binary stream - text hint must fallback to base64 for all chunks
    const pureBinaryStream = createDelayedStream(
      [
        new Uint8Array([0xff, 0xfe, 0x00, 0x01, 0x80, 0x90]),
        new Uint8Array([0xa0, 0xb0, 0xc0, 0xd0, 0xe0, 0xf0]),
      ],
      30,
    )

    return {
      message: 'SSR Text Hint Test',
      pureText: new RawStream(textStream, { hint: 'text' }),
      mixedContent: new RawStream(mixedStream, { hint: 'text' }),
      pureBinary: new RawStream(pureBinaryStream, { hint: 'text' }),
    }
  },
  component: SSRTextHintTest,
})
