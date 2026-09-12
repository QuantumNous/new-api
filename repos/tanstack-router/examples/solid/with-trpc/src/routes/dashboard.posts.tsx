import * as Solid from 'solid-js'
import {
  Link,
  MatchRoute,
  Outlet,
  createFileRoute,
} from '@tanstack/solid-router'

import { Spinner } from './-components/spinner'

export const Route = createFileRoute('/dashboard/posts')({
  loader: ({ context: { trpc } }) => trpc.posts.query(),
  component: DashboardPostsComponent,
})

function DashboardPostsComponent() {
  const posts = Route.useLoaderData()

  return (
    <div class="flex-1 flex">
      <div class="divide-y w-48">
        <Solid.For each={posts()}>
          {(post) => {
            return (
              <div>
                <Link
                  to="/dashboard/posts/$postId"
                  params={{
                    postId: post.id,
                  }}
                  preload="intent"
                  class="block py-2 px-3 text-blue-700"
                  activeProps={{ class: `font-bold` }}
                >
                  <pre class="text-sm">
                    #{post.id} - {post.title.slice(0, 10)}{' '}
                    <MatchRoute
                      to="/dashboard/posts/$postId"
                      params={{
                        postId: post.id,
                      }}
                      pending
                    >
                      {(match) => <Spinner show={!!match} wait="delay-50" />}
                    </MatchRoute>
                  </pre>
                </Link>
              </div>
            )
          }}
        </Solid.For>
      </div>
      <div class="flex-1 border-l border-gray-200">
        <Outlet />
      </div>
    </div>
  )
}
