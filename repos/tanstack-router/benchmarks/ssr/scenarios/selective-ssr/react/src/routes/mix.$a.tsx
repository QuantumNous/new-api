import { Outlet, createFileRoute } from '@tanstack/react-router'
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
      <h2>{`level-a-rendered-${params.a}`}</h2>
      <p>{data.items[0]?.name}</p>
      <Outlet />
    </section>
  )
}
