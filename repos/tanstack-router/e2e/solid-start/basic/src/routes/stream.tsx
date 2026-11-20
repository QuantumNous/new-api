import { Await, createFileRoute } from '@tanstack/solid-router'
import { createEffect, createSignal, Suspense } from 'solid-js'

export const Route = createFileRoute('/stream')({
  component: Home,
  loader() {
    return {
      promise: new Promise<string>((resolve) =>
        setTimeout(() => resolve('promise-data'), 150),
      ),
      stream: new ReadableStream({
        async start(controller) {
          for (let i = 0; i < 5; i++) {
            await new Promise((resolve) => setTimeout(resolve, 200))
            controller.enqueue(`stream-data-${i} `)
          }
          controller.close()
        },
      }),
    }
  },
})

const decoder = new TextDecoder('utf-8')

function Home() {
  const loaderData = Route.useLoaderData()
  const [streamData, setStreamData] = createSignal<Array<string>>([])

  createEffect(() => {
    async function fetchStream() {
      const reader = loaderData().stream.getReader()
      let chunk

      while (!(chunk = await reader.read()).done) {
        let value = chunk.value
        if (typeof value !== 'string') {
          value = decoder.decode(value, { stream: !chunk.done })
        }
        setStreamData((prev) => [...prev, value])
      }
    }

    fetchStream()
  })

  return (
    <Suspense>
      <Await
        promise={loaderData().promise}
        children={(promiseData) => (
          <div class="p-2" data-testid="promise-data">
            {promiseData}
            <div data-testid="stream-data">
              {streamData().map((d) => (
                <div>{d}</div>
              ))}
            </div>
          </div>
        )}
      />
    </Suspense>
  )
}
