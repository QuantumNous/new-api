import { Outlet, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { staticFunctionMiddleware } from '@tanstack/start-static-server-functions'

type Post = {
  id: string
  title: string
}

const fetchPosts = createServerFn({ method: 'GET' })
  .middleware([staticFunctionMiddleware])
  .handler(async () => {
    return [
      { id: '1', title: 'First Post' },
      { id: '2', title: 'Second Post' },
      { id: '3', title: 'Third Post' },
    ] as Array<Post>
  })

export const Route = createFileRoute('/posts')({
  loader: async () => fetchPosts(),
  component: PostsComponent,
})

function PostsComponent() {
  const posts = Route.useLoaderData()

  return (
    <div>
      <h2 data-testid="posts-heading">Posts</h2>
      <ul>
        {posts.map((post) => (
          <li key={post.id} data-testid={`post-${post.id}`}>
            {post.title}
          </li>
        ))}
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
