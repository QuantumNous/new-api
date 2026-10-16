import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/from/$id')({
  loader: ({ params }) => {
    const { id } = params

    throw redirect({ to: '/target/$id', params: { id } })
  },
  component: FromComponent,
})

function FromComponent() {
  return null
}
