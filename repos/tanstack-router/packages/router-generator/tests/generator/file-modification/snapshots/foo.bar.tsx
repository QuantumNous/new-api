// @ts-nocheck

import * as React from 'react'
import { ErrorComponent, ErrorComponentProps, Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/(test)/foo/bar')({
  loader: async ({ params: { postId } }) => ({
    postId,
    title: 'title',
    body: 'body',
    id: 'id',
  }),
  errorComponent: PostErrorComponent as any,
  notFoundComponent: () => {
    return <p>Post not found</p>
  },
  component: PostComponent,
})

export function PostErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}

function PostComponent() {
  const post = Route.useLoaderData()

  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{post.title}</h4>
      <div className="text-sm">{post.body}</div>
      <Link
        to="/posts/$postId/deep"
        params={{
          postId: post.id,
        }}
        activeProps={{ className: 'text-black font-bold' }}
        className="inline-block py-1 text-blue-800 hover:text-blue-600"
      >
        Deep View
      </Link>
    </div>
  )
}
