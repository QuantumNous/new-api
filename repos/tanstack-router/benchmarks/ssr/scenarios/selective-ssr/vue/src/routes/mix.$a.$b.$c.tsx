import { createFileRoute } from '@tanstack/vue-router'
import { makeLevelData } from '../../../../loaders/shared-data'

export const Route = createFileRoute('/mix/$a/$b/$c')({
  ssr: false,
  loader: async ({ params }) => {
    return {
      marker: `level-c-loader-${params.c}`,
      data: makeLevelData(`level-c-data-${params.c}`, 3),
    }
  },
  component: LevelCComponent,
})

function LevelCComponent() {
  const data = Route.useLoaderData()
  const params = Route.useParams()

  return (
    <section>
      <h2>{`csr-rendered-${params.value.c}`}</h2>
      <p>{data.value.marker}</p>
    </section>
  )
}
