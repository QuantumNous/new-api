import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn, createServerOnlyFn } from '@tanstack/solid-start'
import { getRequest } from '@tanstack/solid-start/server'
import * as Solid from 'solid-js'
import z from 'zod'

export const Route = createFileRoute('/abort-signal/$method')({
  params: z.object({
    method: z.union([z.literal('GET'), z.literal('POST')]),
  }),
  component: RouteComponent,
})

const serverFnImpl = createServerOnlyFn(async () => {
  const request = getRequest()
  const signal = request.signal
  console.log('server function started', { signal })
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
const abortableServerFnGET = createServerFn().handler(serverFnImpl)

const abortableServerFnPOST = createServerFn({ method: 'POST' }).handler(
  serverFnImpl,
)

function RouteComponent() {
  const params = Route.useParams()
  const abortableServerFn = () =>
    params().method === 'GET' ? abortableServerFnGET : abortableServerFnPOST
  const [errorMessage, setErrorMessage] = Solid.createSignal<
    string | undefined
  >(undefined)
  const [result, setResult] = Solid.createSignal<string | undefined>(undefined)

  const reset = () => {
    setErrorMessage(undefined)
    setResult(undefined)
  }
  return (
    <div>
      <button
        data-testid="run-with-abort-btn"
        onClick={async () => {
          reset()
          const controller = new AbortController()
          const serverFnPromise = abortableServerFn()({
            signal: controller.signal,
          })
          const timeoutPromise = new Promise((resolve) =>
            setTimeout(resolve, 500),
          )
          await timeoutPromise
          controller.abort()
          try {
            const serverFnResult = await serverFnPromise
            setResult(serverFnResult)
          } catch (error) {
            setErrorMessage((error as any).message)
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
          const serverFnResult = await abortableServerFn()()
          setResult(serverFnResult)
        }}
      >
        call server function
      </button>
      <div class="p-2">
        result: <p data-testid="result">{result() ?? '$undefined'}</p>
      </div>
      <div class="p-2">
        message:{' '}
        <p data-testid="errorMessage">{errorMessage() ?? '$undefined'}</p>
      </div>
    </div>
  )
}
