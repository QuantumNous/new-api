import { useQuery } from '@tanstack/vue-query'
import { createFileRoute, redirect } from '@tanstack/vue-router'
import { createServerFn, useServerFn } from '@tanstack/vue-start'
import { Suspense, defineComponent } from 'vue'

const $redirectServerFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    throw redirect({ to: '/redirect-test-ssr/target' })
  },
)

const RouteComponent = defineComponent({
  setup() {
    const redirectFn = useServerFn($redirectServerFn)
    const query = useQuery(() => ({
      queryKey: ['redirect-test-ssr'],
      queryFn: () => redirectFn(),
      suspense: true,
    }))

    return () => (
      <div>
        <h1 data-testid="redirect-source-ssr">Redirect Source SSR</h1>
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

export const Route = createFileRoute('/redirect-test-ssr/')({
  component: RouteComponent,
  ssr: true,
})
