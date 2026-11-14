import { createFileRoute } from '@tanstack/solid-router'
import { RouteWorkload } from '../workload'

export const Route = createFileRoute('/$a/$b/$c/$d')({
  component: LevelDComponent,
})

function LevelDComponent() {
  return <RouteWorkload />
}
