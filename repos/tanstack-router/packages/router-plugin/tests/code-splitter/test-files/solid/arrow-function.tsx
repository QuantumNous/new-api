import * as Solid from 'solid-js'
import { createFileRoute, Link, Outlet } from '@tanstack/solid-router'
import { fetchPosts } from '../posts'

export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
  component: PostsComponent,
})

const PostsComponent = () => {
  const posts = Route.useLoaderData()

  return (
    <div className="p-2 flex gap-2">
      <ul className="list-disc pl-4">
        <Solid.For each={posts()}>
          {(post) => {
            return (
              <li className="whitespace-nowrap">
                <Link
                  to="/posts/$postId"
                  params={{
                    postId: post.id,
                  }}
                  className="block py-1 text-blue-800 hover:text-blue-600"
                  activeProps={{ className: 'text-black font-bold' }}
                >
                  <div>{post.title.substring(0, 20)}</div>
                </Link>
              </li>
            )
          }}
        </Solid.For>
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
