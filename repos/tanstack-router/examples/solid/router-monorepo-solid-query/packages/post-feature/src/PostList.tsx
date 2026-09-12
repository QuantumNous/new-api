import { useQuery } from '@tanstack/solid-query'
import { postsQueryOptions } from '@router-solid-mono-solid-query/post-query'
import { Link, Outlet } from '@router-solid-mono-solid-query/router'

export function PostsListComponent() {
  const postsQuery = useQuery(() => postsQueryOptions)
  const posts = postsQuery.data

  return (
    <div class="p-2 flex gap-2">
      <ul class="list-disc pl-4">
        {[
          ...(posts || []),
          { id: 'i-do-not-exist', title: 'Non-existent Post' },
        ].map((post) => {
          return (
            <li class="whitespace-nowrap">
              <Link
                to="/$postId"
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
