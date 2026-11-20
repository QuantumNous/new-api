import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/(test)/initiallyEmpty')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/(test)/initiallyEmpty"!</div>
}
