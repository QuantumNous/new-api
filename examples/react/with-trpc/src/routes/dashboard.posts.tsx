import * as React from 'react'
import {
  Link,
  MatchRoute,
  Outlet,
  createFileRoute,
} from '@tanstack/react-router'

import { Spinner } from './-components/spinner'

export const Route = createFileRoute('/dashboard/posts')({
  loader: ({ context: { trpc } }) => trpc.posts.query(),
  component: DashboardPostsComponent,
})

function DashboardPostsComponent() {
  const posts = Route.useLoaderData()

  return (
    <div className="flex-1 flex">
      <div className="divide-y w-48">
        {posts.map((post) => {
          return (
            <div key={post.id}>
              <Link
                to="/dashboard/posts/$postId"
                params={{
                  postId: post.id,
                }}
                preload="intent"
                className="block py-2 px-3 text-blue-700"
                activeProps={{ className: `font-bold` }}
              >
                <pre className="text-sm">
                  #{post.id} - {post.title.slice(0, 10)}{' '}
                  <MatchRoute
                    to="/dashboard/posts/$postId"
                    params={{
                      postId: post.id,
                    }}
                    pending
                  >
                    <Spinner />
                  </MatchRoute>
                </pre>
              </Link>
            </div>
          )
        })}
      </div>
      <div className="flex-1 border-l border-gray-200">
        <Outlet />
      </div>
    </div>
  )
}
