import * as React from 'react'
import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export type PostType = {
  id: string
  title: string
  body: string
}

export const Route = createFileRoute('/posts')({
  loader: async () => {
    console.info('Fetching posts...')
    await new Promise((r) =>
      setTimeout(r, 300 + Math.round(Math.random() * 300)),
    )
    return fetch('https://jsonplaceholder.typicode.com/posts')
      .then((d) => d.json() as Promise<Array<PostType>>)
      .then((d) => d.slice(0, 10))
  },
  component: PostsComponent,
})

function PostsComponent() {
  const posts = Route.useLoaderData()

  return (
    <div className="p-2 flex gap-2">
      <ul className="list-disc pl-4">
        {posts.map((post) => {
          return (
            <li key={post.id} className="whitespace-nowrap">
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
        })}
        <li className="whitespace-nowrap">
          <Link
            to="/posts/$postId"
            params={{
              postId: 'does-not-exist',
            }}
            className="block py-1 text-blue-800 hover:text-blue-600"
            activeProps={{ className: 'text-black font-bold' }}
          >
            <div>This post does not exist</div>
          </Link>
        </li>
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
