import { createFileRoute } from '@tanstack/solid-router'
import { makeLevelData } from '../../../shared-data'

export const Route = createFileRoute('/$a/$b/$c')({
  beforeLoad: ({ params, context }) => {
    void context

    return { ctxC: `v-${params.c}` }
  },
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ params, deps, context }) => {
    void context

    return makeLevelData(params.c, deps.page)
  },
  component: LevelCComponent,
})

function LevelCComponent() {
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
    </section>
  )
}
