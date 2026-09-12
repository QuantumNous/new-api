import { h } from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { fetchPost } from '../posts'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => fetchPost(postId),
  notFoundComponent: () => h('p', 'Post not found'),
})
