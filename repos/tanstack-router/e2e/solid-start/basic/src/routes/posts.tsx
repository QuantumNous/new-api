import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'
import { For } from 'solid-js'

import { fetchPosts } from '~/utils/posts'

export const Route = createFileRoute('/posts')({
  head: () => ({
    meta: [
      {
        title: 'Posts page',
      },
    ],
  }),
  loader: async () => fetchPosts(),
  component: PostsComponent,
})

function PostsComponent() {
  const posts = Route.useLoaderData()

  return (
    <div class="p-2 flex gap-2">
      <ul class="list-disc pl-4">
        <For each={posts()}>
          {(post) => {
            return (
              <li class="whitespace-nowrap">
                <Link
                  to="/posts/$postId"
                  params={{
                    postId: post.id,
                  }}
                  class="block py-1 text-blue-800 hover:text-blue-600"
                  activeProps={{ class: 'text-black font-bold' }}
                >
                  <div>{post.title.substring(0, 20)}</div>
                </Link>
              </li>
            )
          }}
        </For>
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
