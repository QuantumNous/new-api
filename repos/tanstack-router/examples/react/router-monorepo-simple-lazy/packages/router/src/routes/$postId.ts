import { createFileRoute } from '@tanstack/react-router'
import { fetchPost } from '../fetch/posts'

export const Route = createFileRoute('/$postId')({
  loader: ({ params }) => fetchPost(params.postId),
})
