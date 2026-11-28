import { createFileRoute } from '@tanstack/solid-router'
import { fetchPost } from '../fetch/posts'

export const Route = createFileRoute('/$postId')({
  loader: ({ params }) => fetchPost(params.postId),
})
