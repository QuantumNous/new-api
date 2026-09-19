import { createFileRoute } from '@tanstack/react-router'
import { postQueryOptions } from '@router-mono-react-query/post-query'

export const Route = createFileRoute('/$postId')({
  loader: ({ context: { queryClient }, params: { postId } }) => {
    return queryClient.ensureQueryData(postQueryOptions(postId))
  },
})
