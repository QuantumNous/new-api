import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/from/$id')({
  loader: ({ params }) => {
    const { id } = params

    throw redirect({ to: '/target/$id', params: { id }, statusCode: 302 })
  },
  component: FromComponent,
})

function FromComponent() {
  return null
}
