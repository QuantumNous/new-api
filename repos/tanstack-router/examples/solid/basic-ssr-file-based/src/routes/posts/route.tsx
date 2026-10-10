import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'

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
    <div class="p-2 flex gap-2">
      <ul class="list-disc pl-4">
        {posts().map((post) => {
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
        })}
        <li class="whitespace-nowrap">
          <Link
            to="/posts/$postId"
            params={{
              postId: 'does-not-exist',
            }}
            class="block py-1 text-blue-800 hover:text-blue-600"
            activeProps={{ class: 'text-black font-bold' }}
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
