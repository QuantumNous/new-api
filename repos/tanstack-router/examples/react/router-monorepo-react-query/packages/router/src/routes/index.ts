import { createFileRoute } from '@tanstack/react-router'
import { postsQueryOptions } from '@router-mono-react-query/post-query'

export const Route = createFileRoute('/')({
  loader: ({ context: { queryClient } }) => {
    return queryClient.ensureQueryData(postsQueryOptions)
  },
})
