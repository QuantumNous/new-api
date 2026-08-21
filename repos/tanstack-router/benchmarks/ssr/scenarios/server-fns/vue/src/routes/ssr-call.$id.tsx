import { createFileRoute } from '@tanstack/vue-router'
import { echoGet } from '../fns'

export const Route = createFileRoute('/ssr-call/$id')({
  loader: async ({ params }) => {
    const result = await echoGet({
      data: {
        q: `ssr-${params.id}`,
        n: 300,
        nested: { list: [`ssr-call-${params.id}`] },
      },
    })

    return { marker: result.list[0] }
  },
  component: SsrCallComponent,
})

function SsrCallComponent() {
  const data = Route.useLoaderData()

  return <main data-bench="server-fn-ssr-call">{data.value.marker}</main>
}
