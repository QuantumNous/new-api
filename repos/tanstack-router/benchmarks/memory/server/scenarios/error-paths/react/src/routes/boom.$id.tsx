import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/boom/$id')({
  loader: ({ params }) => {
    throw new Error(`boom-${params.id}`)
  },
  errorComponent: BoomErrorComponent,
  component: BoomComponent,
})

function BoomErrorComponent() {
  return <main data-bench="error-boundary">error-paths-error-boundary</main>
}

function BoomComponent() {
  return null
}
