import { Link, Outlet, createFileRoute } from '@tanstack/vue-router'
import { fetchPosts } from '../posts'

export const Route = createFileRoute('/posts')({
  loader: fetchPosts,
  component: PostsLayoutComponent,
})

function PostsLayoutComponent() {
  const posts = Route.useLoaderData()

  return (
    <div class="p-2 flex gap-2  [view-transition-name:main-content]">
      <ul class="list-disc pl-4">
        {[
          ...posts.value,
          { id: 'i-do-not-exist', title: 'Non-existent Post' },
        ].map((post) => {
          return (
            <li class="whitespace-nowrap">
              <Link
                to="/posts/$postId"
                params={{
                  postId: post.id,
                }}
                class="block py-1 text-blue-600 hover:opacity-75"
                activeProps={{ class: 'font-bold underline' }}
                // see styles.css for 'warp' transition
                viewTransition={{ types: ['warp'] }}
              >
                <div>{post.title.substring(0, 20)}</div>
              </Link>
            </li>
          )
        })}
      </ul>
      <hr />
      <div class="[view-transition-name:post]">
        <Outlet />
      </div>
    </div>
  )
}
