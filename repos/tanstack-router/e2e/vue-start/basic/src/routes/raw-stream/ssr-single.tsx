import { createFileRoute, useRouter } from '@tanstack/vue-router'
import { RawStream } from '@tanstack/vue-start'
import { defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createDelayedStream,
  createStreamConsumer,
  encode,
} from '../../raw-stream-fns'

const SSRSingleTest = defineComponent({
  setup() {
    const loaderData = Route.useLoaderData()
    const router = useRouter()
    const streamContent = ref('')
    const isConsuming = ref(true)
    const error = ref<string | null>(null)

    let consumeRunId = 0
    const consumeRawStream = (
      rawData: ReadableStream<Uint8Array> | RawStream | undefined,
    ) => {
      if (!rawData) {
        return Promise.resolve()
      }
      const consumeStream = createStreamConsumer()
      const currentRun = ++consumeRunId
      isConsuming.value = true
      error.value = null
      return consumeStream(rawData)
        .then((content) => {
          if (currentRun !== consumeRunId) {
            return
          }
          streamContent.value = content
          isConsuming.value = false
        })
        .catch((err) => {
          if (currentRun !== consumeRunId) {
            return
          }
          error.value = String(err)
          isConsuming.value = false
        })
    }

    let stopWatcher: (() => void) | undefined
    let lastRawData: ReadableStream<Uint8Array> | RawStream | undefined
    let didInvalidate = false

    onMounted(() => {
      stopWatcher = watch(
        () => loaderData.value.rawData,
        (rawData) => {
          if (!rawData || rawData === lastRawData) {
            return
          }
          lastRawData = rawData
          void consumeRawStream(rawData)
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
        <h2>SSR Single RawStream Test</h2>
        <p class="text-gray-600">
          This route returns a single RawStream from its loader. The stream is
          serialized during SSR using base64 encoding.
        </p>

        <div class="border p-4 rounded">
          <div data-testid="ssr-single-message">
            Message: {loaderData.value.message}
          </div>
          <div data-testid="ssr-single-timestamp">
            Has Timestamp:{' '}
            {typeof loaderData.value.timestamp === 'number' ? 'true' : 'false'}
          </div>
          <div data-testid="ssr-single-stream">
            Stream Content:
            {error.value
              ? `Error: ${error.value}`
              : isConsuming.value
                ? 'Loading...'
                : streamContent.value}
          </div>
          <div data-testid="ssr-single-rawdata-type">
            RawData Type: {typeof loaderData.value.rawData} | hasStream:
            {loaderData.value.rawData && 'getReader' in loaderData.value.rawData
              ? 'true'
              : 'false'}
          </div>
          <pre data-testid="ssr-single-result">
            {JSON.stringify({
              message: loaderData.value.message,
              streamContent: streamContent.value,
              isConsuming: isConsuming.value,
              error: error.value,
            })}
          </pre>
        </div>
      </div>
    )
  },
})

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
  shouldReload: __TSR_PRERENDER__,
  component: SSRSingleTest,
})
