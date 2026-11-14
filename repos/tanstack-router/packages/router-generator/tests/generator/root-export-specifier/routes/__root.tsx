import { createRootRoute } from '@tanstack/react-router'

const Route = createRootRoute({
  component: RootComponent,
})

export { Route }

function RootComponent() {
  return null
}
