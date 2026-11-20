import { createFileRoute } from '@tanstack/react-router'
import {
  makeLargePageHead,
  makeLargePageLevelData,
} from '../../../large-page-data'

export const Route = createFileRoute('/l1/l2/l3/l4/l5/l6/l7/l8')({
  loader: () => makeLargePageLevelData(8, 0x5eed_1008),
  head: ({ loaderData }) => makeLargePageHead(loaderData),
  component: LevelEightComponent,
})

function LevelEightComponent() {
  const data = Route.useLoaderData()
  const first = data.records[0]!

  return (
    <section data-bench={data.marker}>
      <h2>{data.marker}</h2>
      <p>records: {data.records.length}</p>
      <article>
        <h3>{first.name}</h3>
        <p>{first.id}</p>
        <p>{first.description}</p>
      </article>
    </section>
  )
}
