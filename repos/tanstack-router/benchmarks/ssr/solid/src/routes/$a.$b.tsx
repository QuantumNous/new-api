import { Outlet, createFileRoute } from '@tanstack/solid-router'
import { RouteWorkload } from '../workload'

export const Route = createFileRoute('/$a/$b')({
  component: LevelBComponent,
})

function LevelBComponent() {
  return (
    <>
      <RouteWorkload />
      <Outlet />
    </>
  )
}
