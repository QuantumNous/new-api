import { Outlet, createFileRoute } from '@tanstack/vue-router'
import { makeLevelData } from '../../../shared-data'

export const Route = createFileRoute('/$a')({
  beforeLoad: ({ params, context }) => {
    void context

    return { ctxA: `v-${params.a}` }
  },
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ params, deps, context }) => {
    void context

    return makeLevelData(params.a, deps.page)
  },
  component: LevelAComponent,
})

function LevelAComponent() {
  const data = Route.useLoaderData()

  return (
    <section>
      <h2>{data.value.meta.label}</h2>
      <ul>
        {data.value.items.slice(0, 10).map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
      <Outlet />
    </section>
  )
}
