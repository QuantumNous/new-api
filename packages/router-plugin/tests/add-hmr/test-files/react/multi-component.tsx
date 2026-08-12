import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { fetchPosts } from '../posts'

export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
  component: PostsComponent,
  errorComponent: PostsErrorComponent,
})

function PostsComponent() {
  const posts = Route.useLoaderData()

  return <div>{posts.length} posts</div>
}

function PostsErrorComponent() {
  return <div>Error loading posts</div>
}
