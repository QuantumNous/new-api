import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'
import { m } from '@/paraglide/messages.js'
// import { getLocale } from '@/paraglide/runtime.js'

const getServerMessage = createServerFn()
  .validator((emoji: string) => emoji)
  .handler((ctx) => {
    return m.server_message({ emoji: ctx.data })
  })

export const Route = createFileRoute('/')({
  component: Home,
  loader: async () => {
    return {
      messageFromLoader: m.example_message({ username: 'John Doe' }),
      serverFunctionMessage: await getServerMessage({ data: '📩' }),
    }
  },
})

function Home() {
  const loaderData = Route.useLoaderData()
  return (
    <div class="p-2">
      <h2>Message from loader: {loaderData().messageFromLoader}</h2>
      <h2>Server function message: {loaderData().serverFunctionMessage}:</h2>
      <h2>{m.example_message({ username: 'John Doe' })}</h2>
    </div>
  )
}
