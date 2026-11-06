import { Outlet, createFileRoute } from '@tanstack/vue-router'
import {
  makeLargePageHead,
  makeLargePageLevelData,
} from '../../../large-page-data'

export const Route = createFileRoute('/l1/l2')({
  loader: () => makeLargePageLevelData(2, 0x5eed_1002),
  head: ({ loaderData }) => makeLargePageHead(loaderData),
  component: LevelTwoComponent,
})

function LevelTwoComponent() {
  const data = Route.useLoaderData()
  const first = data.value.records[0]!

  return (
    <section data-bench={data.value.marker}>
      <h2>{data.value.marker}</h2>
      <p>records: {data.value.records.length}</p>
      <article>
        <h3>{first.name}</h3>
        <p>{first.id}</p>
        <p>{first.description}</p>
      </article>
      <Outlet />
    </section>
  )
}
