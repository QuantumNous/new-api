import { Outlet, createFileRoute } from '@tanstack/solid-router'
import {
  makeLargePageHead,
  makeLargePageLevelData,
} from '../../../large-page-data'

export const Route = createFileRoute('/l1/l2/l3/l4/l5')({
  loader: () => makeLargePageLevelData(5, 0x5eed_1005),
  head: ({ loaderData }) => makeLargePageHead(loaderData),
  component: LevelFiveComponent,
})

function LevelFiveComponent() {
  const data = Route.useLoaderData()
  const first = () => data().records[0]!

  return (
    <section data-bench={data().marker}>
      <h2>{data().marker}</h2>
      <p>records: {data().records.length}</p>
      <article>
        <h3>{first().name}</h3>
        <p>{first().id}</p>
        <p>{first().description}</p>
      </article>
      <Outlet />
    </section>
  )
}
