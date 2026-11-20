import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useState } from 'react'

const getGreeting = createServerFn()
  .validator((d: { name: string }) => d)
  .handler(({ data }) => ({ greeting: `Hello, ${data.name}!` }))

const postMessage = createServerFn({ method: 'POST' })
  .validator((d: { message: string }) => d)
  .handler(({ data }) => ({ echo: `Echo: ${data.message}` }))

export const Route = createFileRoute('/')({
  loader: async () => {
    const result = await getGreeting({ data: { name: 'Loader' } })
    return { loaderGreeting: result.greeting }
  },
  component: ServerFnsComponent,
})

function ServerFnsComponent() {
  const { loaderGreeting } = Route.useLoaderData()
  const [clientGreeting, setClientGreeting] = useState<string>('')
  const [echoResult, setEchoResult] = useState<string>('')

  return (
    <div className="p-2">
      <h3>Server Functions</h3>

      <section className="mt-2">
        <h4>Loader (SSR)</h4>
        <p data-testid="loader-greeting">{loaderGreeting}</p>
      </section>

      <section className="mt-2">
        <h4>GET server function</h4>
        <button
          type="button"
          onClick={async () => {
            const result = await getGreeting({ data: { name: 'Client' } })
            setClientGreeting(result.greeting)
          }}
          className="px-2 py-1 bg-blue-600 text-white rounded"
        >
          Call getGreeting
        </button>
        {clientGreeting && (
          <p data-testid="client-greeting">{clientGreeting}</p>
        )}
      </section>

      <section className="mt-2">
        <h4>POST server function</h4>
        <button
          type="button"
          onClick={async () => {
            const result = await postMessage({
              data: { message: 'hello from client' },
            })
            setEchoResult(result.echo)
          }}
          className="px-2 py-1 bg-blue-600 text-white rounded"
        >
          Call postMessage
        </button>
        {echoResult && <p data-testid="echo-result">{echoResult}</p>}
      </section>
    </div>
  )
}
