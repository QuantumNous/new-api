import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Link, Outlet } from '@tanstack/react-router'
import { fetchPosts } from '../posts'

export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
  component: PostsLayoutComponent,
})

function PostsLayoutComponent() {
  const posts = Route.useLoaderData()

  return (
    <div className="p-2 flex gap-2  [view-transition-name:main-content]">
      <ul className="list-disc pl-4">
        {[...posts, { id: 'i-do-not-exist', title: 'Non-existent Post' }].map(
          (post) => {
            return (
              <li key={post.id} className="whitespace-nowrap">
                <Link
                  to="/posts/$postId"
                  params={{
                    postId: post.id,
                  }}
                  className="block py-1 text-blue-600 hover:opacity-75"
                  activeProps={{ className: 'font-bold underline' }}
                  // see styles.css for 'warp' transition
                  viewTransition={{ types: ['warp'] }}
                >
                  <div>{post.title.substring(0, 20)}</div>
                </Link>
              </li>
            )
          },
        )}
      </ul>
      <hr />
      <div className="[view-transition-name:post]">
        <Outlet />
      </div>
    </div>
  )
}
