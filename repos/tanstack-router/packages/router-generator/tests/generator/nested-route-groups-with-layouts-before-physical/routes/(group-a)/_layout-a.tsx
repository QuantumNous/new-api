import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/(group-a)/_layout-a')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(group-a)/_layout-a"!</div>
}
