import { Link, Outlet, createFileRoute } from '@tanstack/vue-router'
import { useQuery } from '@tanstack/vue-query'
import { postsQueryOptions } from '../postsQueryOptions'

export const Route = createFileRoute('/posts')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(postsQueryOptions),
  component: PostsComponent,
})

function PostsComponent() {
  useQuery(postsQueryOptions)
  const posts = Route.useLoaderData()

  return (
    <div class="p-2 flex gap-2">
      <ul class="list-disc pl-4">
        {[
          ...posts.value,
          { id: 'i-do-not-exist', title: 'Non-existent Post' },
        ].map((post) => {
          return (
            <li key={post.id} class="whitespace-nowrap">
              <Link
                to="/posts/$postId"
                params={{
                  postId: post.id,
                }}
                class="block py-1 text-blue-600 hover:opacity-75"
                activeProps={{ class: 'font-bold underline' }}
              >
                <div>{post.title.substring(0, 20)}</div>
              </Link>
            </li>
          )
        })}
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
