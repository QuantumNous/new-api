import { Link, Outlet, getRouteApi } from '@router-mono-simple/router'

const route = getRouteApi('/')

export function PostsListComponent() {
  const posts = route.useLoaderData()

  return (
    <div className="p-2 flex gap-2">
      <ul className="list-disc pl-4">
        {[...posts, { id: 'i-do-not-exist', title: 'Non-existent Post' }].map(
          (post) => {
            return (
              <li key={post.id} className="whitespace-nowrap">
                <Link
                  to="/$postId"
                  params={{
                    postId: post.id,
                  }}
                  className="block py-1 text-blue-600 hover:opacity-75"
                  activeProps={{ className: 'font-bold underline' }}
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
