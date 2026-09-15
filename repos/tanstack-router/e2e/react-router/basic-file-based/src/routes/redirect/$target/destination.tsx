import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/redirect/$target/destination')({
  component: () => (
    <div data-testid="redirect-destination">
      Redirect destination for {Route.fullPath}
    </div>
  ),
})
