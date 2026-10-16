import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

export const Route = createFileRoute('/posts/')({
  component: PostsIndexComponent,
})

function PostsIndexComponent() {
  return <div>Select a post.</div>
}
