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

const SSRBinaryHintTest = defineComponent({
  setup() {
    const loaderData = Route.useLoaderData()
    const router = useRouter()
    const textMatch = ref<TextMatch | null>(null)
    const binaryMatch = ref<BinaryMatch | null>(null)
    const isLoading = ref(true)
    const error = ref<string | null>(null)

    let consumeRunId = 0
    const consumeHintStreams = (
      textData: ReadableStream<Uint8Array> | RawStream | undefined,
      binaryData: ReadableStream<Uint8Array> | RawStream | undefined,
    ) => {
      if (!textData || !binaryData) {
        return Promise.resolve()
      }
      const currentRun = ++consumeRunId
      isLoading.value = true
      error.value = null
      return Promise.all([collectBytes(textData), collectBytes(binaryData)])
        .then(([textBytes, binaryBytes]) => {
          if (currentRun !== consumeRunId) {
            return
          }
          const textComp = compareBytes(textBytes, TEXT_EXPECTED)
          const decoder = new TextDecoder()
          textMatch.value = {
            ...textComp,
            actualLength: textBytes.length,
            expectedLength: TEXT_EXPECTED.length,
            asText: decoder.decode(textBytes),
          }
          const binaryComp = compareBytes(binaryBytes, BINARY_EXPECTED)
          binaryMatch.value = {
            ...binaryComp,
            actualLength: binaryBytes.length,
            expectedLength: BINARY_EXPECTED.length,
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
        ]
      | undefined
    let didInvalidate = false

    onMounted(() => {
      stopWatcher = watch(
        () => [loaderData.value.textData, loaderData.value.binaryData],
        ([textData, binaryData]) => {
          if (!textData || !binaryData) {
            return
          }
          if (
            lastStreams &&
            lastStreams[0] === textData &&
            lastStreams[1] === binaryData
          ) {
            return
          }
          lastStreams = [textData, binaryData]
          void consumeHintStreams(textData, binaryData)
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
        <h2>SSR Binary Hint Test</h2>
        <p class="text-gray-600">
          This route tests RawStream with hint: 'binary' from loader. Binary
          hint always uses base64 encoding (default behavior).
        </p>

        <div class="border p-4 rounded">
          <div data-testid="ssr-binary-hint-message">
            Message: {loaderData.value.message}
          </div>
          <div data-testid="ssr-binary-hint-text">
            Text Data:
            {error.value
              ? `Error: ${error.value}`
              : isLoading.value
                ? 'Loading...'
                : textMatch.value?.asText}
          </div>
          <div data-testid="ssr-binary-hint-text-match">
            Text Bytes Match:
            {isLoading.value
              ? 'Loading...'
              : textMatch.value?.match
                ? 'true'
                : 'false'}
          </div>
          <div data-testid="ssr-binary-hint-binary-match">
            Binary Bytes Match:
            {isLoading.value
              ? 'Loading...'
              : binaryMatch.value?.match
                ? 'true'
                : 'false'}
          </div>
          <pre data-testid="ssr-binary-hint-result">
            {JSON.stringify({
              message: loaderData.value.message,
              textMatch: textMatch.value,
              binaryMatch: binaryMatch.value,
              isLoading: isLoading.value,
              error: error.value,
            })}
          </pre>
        </div>
      </div>
    )
  },
})

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
  shouldReload: __TSR_PRERENDER__,
  component: SSRBinaryHintTest,
})
