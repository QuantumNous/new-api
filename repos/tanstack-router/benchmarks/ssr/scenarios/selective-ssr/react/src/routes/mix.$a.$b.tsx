import { Outlet, createFileRoute } from '@tanstack/react-router'
import { makeLevelData } from '../../../../loaders/shared-data'

export const Route = createFileRoute('/mix/$a/$b')({
  ssr: 'data-only',
  loader: async ({ params }) => {
    return {
      marker: `level-b-loader-${params.b}`,
      data: makeLevelData(`level-b-data-${params.b}`, 2),
    }
  },
  component: LevelBComponent,
})

function LevelBComponent() {
  const data = Route.useLoaderData()
  const params = Route.useParams()

  return (
    <section>
      <h2>{`data-only-rendered-${params.b}`}</h2>
      <p>{data.marker}</p>
      <Outlet />
    </section>
  )
}
