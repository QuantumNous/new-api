import { Link, Outlet, createLazyRoute } from '@tanstack/vue-router'
import { useQuery } from '@tanstack/vue-query'
import { postsQueryOptions } from './posts'

export const Route = createLazyRoute('/posts')({
  component: PostsComponent,
})

function PostsComponent() {
  const postsQuery = useQuery(postsQueryOptions)
  const posts = postsQuery.data

  return (
    <div class="p-2 flex gap-2">
      <ul class="list-disc pl-4">
        {[
          ...((posts.value ?? []) as Array<{ id: string; title: string }>),
          { id: 'i-do-not-exist', title: 'Non-existent Post' },
        ].map((post) => {
          return (
            <li key={post.id} class="whitespace-nowrap">
              <Link
                to="/posts/$postId"
                params={{
                  postId: post.id,
                }}
                class="block py-1 px-2 text-blue-600 hover:opacity-75"
                activeProps={{ class: 'font-bold underline' }}
              >
                <div>{post.title.substring(0, 20)}</div>
              </Link>
            </li>
          )
        })}
      </ul>
      <Outlet />
    </div>
  )
}
