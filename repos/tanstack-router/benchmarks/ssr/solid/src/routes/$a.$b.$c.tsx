import { Outlet, createFileRoute } from '@tanstack/solid-router'
import { RouteWorkload } from '../workload'

export const Route = createFileRoute('/$a/$b/$c')({
  component: LevelCComponent,
})

function LevelCComponent() {
  return (
    <>
      <RouteWorkload />
      <Outlet />
    </>
  )
}
