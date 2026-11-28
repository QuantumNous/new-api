import { useQuery } from '@tanstack/vue-query'
import { createFileRoute, redirect } from '@tanstack/vue-router'
import { createServerFn, useServerFn } from '@tanstack/vue-start'
import { Suspense, defineComponent } from 'vue'

const $redirectServerFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    throw redirect({ to: '/redirect-test/target' })
  },
)

const RouteComponent = defineComponent({
  setup() {
    const redirectFn = useServerFn($redirectServerFn)
    const query = useQuery(() => ({
      queryKey: ['redirect-test'],
      queryFn: () => redirectFn(),
      suspense: true,
    }))

    return () => (
      <div>
        <h1 data-testid="redirect-source">Redirect Source</h1>
        <Suspense>
          {{
            default: () => <div>{JSON.stringify(query.data.value)}</div>,
            fallback: () => <div>Loading...</div>,
          }}
        </Suspense>
      </div>
    )
  },
})

export const Route = createFileRoute('/redirect-test/')({
  component: RouteComponent,
  ssr: 'data-only',
})
