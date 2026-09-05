import { createLazyFileRoute } from '@tanstack/react-router'

export const Route = createLazyFileRoute('/lazy-error')({
  component: LazyErrorComponent,
  errorComponent: () => (
    <div data-testid="lazy-route-error-component">
      Lazy route error component
    </div>
  ),
})

function LazyErrorComponent() {
  return <div data-testid="lazy-route-component">Lazy route component</div>
}
