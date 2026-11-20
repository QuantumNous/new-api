import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/error')({
  component: ErrorComponent,
  loader: () => {
    if (Math.random() > 0.5) throw new Error('Random error!')
  },
  pendingComponent: () => <p>Loading..</p>,
  wrapInSuspense: true,
  errorComponent: ({ error }) => {
    return (
      <div class="p-2">
        <h3>Caught: {error.message}</h3>
        <p>(This page has a 75% chance of throwing an error)</p>
      </div>
    )
  },
})

function ErrorComponent() {
  return (
    <div class="p-2">
      <h3>
        The loader of this page will have a 75% chance of throwing an error!
      </h3>
    </div>
  )
}
