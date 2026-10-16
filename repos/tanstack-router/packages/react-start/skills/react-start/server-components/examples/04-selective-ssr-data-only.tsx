// Selective SSR: the loader fetches the RSC on the server,
// but the route component renders on the client because it needs browser APIs.

import * as React from 'react'
import type { ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  CompositeComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc'

// Replace with your own server-side data source
declare function getDashboardStats(): Promise<{
  series: Array<{ x: number; y: number }>
  totalUsers: number
}>

const getDashboard = createServerFn({ method: 'GET' }).handler(async () => {
  const stats = await getDashboardStats()

  const src = await createCompositeComponent<{
    renderChart?: (args: {
      series: Array<{ x: number; y: number }>
    }) => ReactNode
  }>((props) => (
    <section>
      <h1>Users: {stats.totalUsers}</h1>
      {props.renderChart?.({ series: stats.series })}
    </section>
  ))

  return { src }
})

export const Route = createFileRoute('/dashboard')({
  ssr: 'data-only',
  loader: async () => ({
    Dashboard: await getDashboard(),
  }),
  component: DashboardPage,
})

function DashboardPage() {
  const { Dashboard } = Route.useLoaderData()
  const [width, setWidth] = React.useState(0)

  React.useEffect(() => {
    setWidth(window.innerWidth)
  }, [])

  return (
    <CompositeComponent
      src={Dashboard.src}
      renderChart={({ series }) => (
        <ResponsiveChart data={series} width={width} />
      )}
    />
  )
}

// Replace with your real chart component
function ResponsiveChart(props: {
  data: Array<{ x: number; y: number }>
  width: number
}) {
  return (
    <pre>
      {JSON.stringify({ width: props.width, points: props.data.length })}
    </pre>
  )
}
