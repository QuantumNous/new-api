import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'
import { fetchPosts } from '../utils/posts'

export const Route = createFileRoute('/posts')({
  loader: async () => fetchPosts(),
  component: PostsComponent,
})

function PostsComponent() {
  const posts = Route.useLoaderData()

  return (
    <div class="p-2 flex gap-2">
      <ul class="list-disc pl-4">
        {[...posts(), { id: 'i-do-not-exist', title: 'Non-existent Post' }].map(
          (post) => {
            return (
              <li class="whitespace-nowrap">
                <Link
                  to="/posts/$postId"
                  params={{
                    postId: String(post.id),
                  }}
                  class="block py-1 text-blue-800 hover:text-blue-600"
                  activeProps={{ class: 'text-black font-bold' }}
                >
                  <div>{post.title.substring(0, 20)}</div>
                </Link>
              </li>
            )
          },
        )}
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
