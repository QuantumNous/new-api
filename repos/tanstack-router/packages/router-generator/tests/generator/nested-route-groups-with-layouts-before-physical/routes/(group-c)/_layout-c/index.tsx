import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/(group-c)/_layout-c/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(group-c)/_layout-c/"!</div>
}
