import { createFileRoute } from '@tanstack/react-router'
import { RouteWorkload } from '../workload'

export const Route = createFileRoute('/$a/$b/$c/$d')({
  component: LevelDComponent,
})

function LevelDComponent() {
  return <RouteWorkload />
}
