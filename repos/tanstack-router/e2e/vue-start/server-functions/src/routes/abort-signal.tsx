import { createFileRoute } from '@tanstack/vue-router'
import { createServerFn } from '@tanstack/vue-start'
import { getRequest } from '@tanstack/vue-start/server'
import { defineComponent, ref } from 'vue'

const abortableServerFn = createServerFn().handler(async ({ context }) => {
  console.log('server function started', { context })
  const signal = getRequest().signal
  return new Promise<string>((resolve, reject) => {
    if (signal.aborted) {
      return reject(new Error('Aborted before start'))
    }
    const timerId = setTimeout(() => {
      console.log('server function finished')
      resolve('server function result')
    }, 1000)
    const onAbort = () => {
      clearTimeout(timerId)
      console.log('server function aborted')
      reject(new Error('Aborted'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
})

const RouteComponent = defineComponent({
  setup() {
    const errorMessage = ref<string | undefined>(undefined)
    const result = ref<string | undefined>(undefined)

    const reset = () => {
      errorMessage.value = undefined
      result.value = undefined
    }

    return () => (
      <div>
        <button
          data-testid="run-with-abort-btn"
          onClick={async () => {
            reset()
            const controller = new AbortController()
            const serverFnPromise = abortableServerFn({
              signal: controller.signal,
            })
            const timeoutPromise = new Promise((resolve) =>
              setTimeout(resolve, 500),
            )
            await timeoutPromise
            controller.abort()
            try {
              const serverFnResult = await serverFnPromise
              result.value = serverFnResult
            } catch (error) {
              errorMessage.value = (error as any).message
            }
          }}
        >
          call server function with abort signal
        </button>
        <br />
        <button
          data-testid="run-without-abort-btn"
          onClick={async () => {
            reset()
            const serverFnResult = await abortableServerFn()
            result.value = serverFnResult
          }}
        >
          call server function
        </button>
        <div class="p-2">
          result: <p data-testid="result">{result.value ?? '$undefined'}</p>
        </div>
        <div class="p-2">
          message:{' '}
          <p data-testid="errorMessage">{errorMessage.value ?? '$undefined'}</p>
        </div>
      </div>
    )
  },
})

export const Route = createFileRoute('/abort-signal')({
  component: RouteComponent,
})
