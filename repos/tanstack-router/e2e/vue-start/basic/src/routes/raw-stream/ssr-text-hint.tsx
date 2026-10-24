import { createFileRoute, useRouter } from '@tanstack/vue-router'
import { RawStream } from '@tanstack/vue-start'
import { defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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

const SSRTextHintTest = defineComponent({
  setup() {
    const loaderData = Route.useLoaderData()
    const router = useRouter()
    const pureTextMatch = ref<TextMatch | null>(null)
    const mixedMatch = ref<BinaryMatch | null>(null)
    const pureBinaryMatch = ref<BinaryMatch | null>(null)
    const isLoading = ref(true)
    const error = ref<string | null>(null)

    let consumeRunId = 0
    const consumeHintStreams = (
      pureText: ReadableStream<Uint8Array> | RawStream | undefined,
      mixedContent: ReadableStream<Uint8Array> | RawStream | undefined,
      pureBinary: ReadableStream<Uint8Array> | RawStream | undefined,
    ) => {
      if (!pureText || !mixedContent || !pureBinary) {
        return Promise.resolve()
      }
      const currentRun = ++consumeRunId
      isLoading.value = true
      error.value = null
      return Promise.all([
        collectBytes(pureText),
        collectBytes(mixedContent),
        collectBytes(pureBinary),
      ])
        .then(([pureBytes, mixedBytes, pureBinaryBytes]) => {
          if (currentRun !== consumeRunId) {
            return
          }
          const pureComp = compareBytes(pureBytes, PURE_TEXT_EXPECTED)
          const decoder = new TextDecoder()
          pureTextMatch.value = {
            ...pureComp,
            actualLength: pureBytes.length,
            expectedLength: PURE_TEXT_EXPECTED.length,
            asText: decoder.decode(pureBytes),
          }
          const mixedComp = compareBytes(mixedBytes, MIXED_EXPECTED)
          mixedMatch.value = {
            ...mixedComp,
            actualLength: mixedBytes.length,
            expectedLength: MIXED_EXPECTED.length,
          }
          const pureBinaryComp = compareBytes(
            pureBinaryBytes,
            PURE_BINARY_EXPECTED,
          )
          pureBinaryMatch.value = {
            ...pureBinaryComp,
            actualLength: pureBinaryBytes.length,
            expectedLength: PURE_BINARY_EXPECTED.length,
          }
          isLoading.value = false
        })
        .catch((err) => {
          if (currentRun !== consumeRunId) {
            return
          }
          error.value = String(err)
          isLoading.value = false
        })
    }

    let stopWatcher: (() => void) | undefined
    let lastStreams:
      | [
          ReadableStream<Uint8Array> | RawStream,
          ReadableStream<Uint8Array> | RawStream,
          ReadableStream<Uint8Array> | RawStream,
        ]
      | undefined
    let didInvalidate = false

    onMounted(() => {
      stopWatcher = watch(
        () => [
          loaderData.value.pureText,
          loaderData.value.mixedContent,
          loaderData.value.pureBinary,
        ],
        ([pureText, mixedContent, pureBinary]) => {
          if (!pureText || !mixedContent || !pureBinary) {
            return
          }
          if (
            lastStreams &&
            lastStreams[0] === pureText &&
            lastStreams[1] === mixedContent &&
            lastStreams[2] === pureBinary
          ) {
            return
          }
          lastStreams = [pureText, mixedContent, pureBinary]
          void consumeHintStreams(pureText, mixedContent, pureBinary)
        },
        { immediate: true },
      )

      if (__TSR_PRERENDER__ && !didInvalidate) {
        didInvalidate = true
        void router.invalidate({
          filter: (match) => match.routeId === Route.id,
        })
      }
    })

    onBeforeUnmount(() => {
      stopWatcher?.()
    })

    return () => (
      <div class="space-y-4">
        <h2>SSR Text Hint Test</h2>
        <p class="text-gray-600">
          This route tests RawStream with hint: 'text' from loader. Text hint
          optimizes for UTF-8 content but falls back to base64 for invalid
          UTF-8.
        </p>

        <div class="border p-4 rounded">
          <div data-testid="ssr-text-hint-message">
            Message: {loaderData.value.message}
          </div>
          <div data-testid="ssr-text-hint-pure-text">
            Pure Text:
            {error.value
              ? `Error: ${error.value}`
              : isLoading.value
                ? 'Loading...'
                : pureTextMatch.value?.asText}
          </div>
          <div data-testid="ssr-text-hint-pure-match">
            Pure Text Bytes Match:
            {isLoading.value
              ? 'Loading...'
              : pureTextMatch.value?.match
                ? 'true'
                : 'false'}
          </div>
          <div data-testid="ssr-text-hint-mixed-match">
            Mixed Content Bytes Match:
            {isLoading.value
              ? 'Loading...'
              : mixedMatch.value?.match
                ? 'true'
                : 'false'}
          </div>
          <div data-testid="ssr-text-hint-pure-binary-match">
            Pure Binary Bytes Match:
            {isLoading.value
              ? 'Loading...'
              : pureBinaryMatch.value?.match
                ? 'true'
                : 'false'}
          </div>
          <pre data-testid="ssr-text-hint-result">
            {JSON.stringify({
              message: loaderData.value.message,
              pureTextMatch: pureTextMatch.value,
              mixedMatch: mixedMatch.value,
              pureBinaryMatch: pureBinaryMatch.value,
              isLoading: isLoading.value,
              error: error.value,
            })}
          </pre>
        </div>
      </div>
    )
  },
})

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
  shouldReload: __TSR_PRERENDER__,
  component: SSRTextHintTest,
})
