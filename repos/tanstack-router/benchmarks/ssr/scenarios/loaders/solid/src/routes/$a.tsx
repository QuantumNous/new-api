import { Outlet, createFileRoute } from '@tanstack/solid-router'
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
      <h2>{data().meta.label}</h2>
      <ul>
        {data()
          .items.slice(0, 10)
          .map((item) => (
            <li>{item.name}</li>
          ))}
      </ul>
      <Outlet />
    </section>
  )
}
