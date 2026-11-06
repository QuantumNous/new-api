import { Outlet, createFileRoute } from '@tanstack/vue-router'
import { makeLevelData } from '../../../../loaders/shared-data'

export const Route = createFileRoute('/mix/$a')({
  ssr: true,
  loader: async ({ params }) => {
    return makeLevelData(`level-a-loader-${params.a}`, 1)
  },
  component: LevelAComponent,
})

function LevelAComponent() {
  const data = Route.useLoaderData()
  const params = Route.useParams()

  return (
    <section>
      <h2>{`level-a-rendered-${params.value.a}`}</h2>
      <p>{data.value.items[0]?.name}</p>
      <Outlet />
    </section>
  )
}
