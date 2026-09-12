import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/primitive-beforeload-error')({
  beforeLoad: () => {
    throw 'primitive beforeLoad error'
  },
  component: () => {
    return (
      <div data-testid="primitive-beforeload-route-component">
        This should not render.
      </div>
    )
  },
  errorComponent: ({ error }) => {
    return (
      <div data-testid="primitive-beforeload-error-component">
        {String(error)}
      </div>
    )
  },
})
