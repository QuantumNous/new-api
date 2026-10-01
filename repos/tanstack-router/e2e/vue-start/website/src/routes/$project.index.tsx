import { redirect, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/$project/')({
  loader: ({ params }) => {
    throw redirect({
      to: '/$project/$version',
      params: {
        project: params.project,
        version: 'latest',
      },
    })
  },
})
