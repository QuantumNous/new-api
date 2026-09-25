import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/(group-b)/_layout-b/dashboard')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(group-b)/_layout/dashboard"!</div>
}
