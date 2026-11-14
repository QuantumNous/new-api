import { useQuery } from '@tanstack/vue-query'
import { Link, Outlet, createFileRoute } from '@tanstack/vue-router'
import { Suspense, defineComponent } from 'vue'
import { postsQueryOptions } from '~/utils/posts'

const PostsList = defineComponent({
  async setup() {
    const postsQuery = useQuery(postsQueryOptions())
    await postsQuery.suspense()

    return () => {
      const posts = [
        ...(postsQuery.data.value ?? []),
        { id: 'i-do-not-exist', title: 'Non-existent Post' },
      ]

      return (
        <ul class="list-disc pl-4">
          {posts.map((post) => (
            <li class="whitespace-nowrap" key={post.id}>
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
          ))}
        </ul>
      )
    }
  },
})

const PostsComponent = defineComponent({
  setup() {
    return () => {
      return (
        <div class="p-2 flex gap-2">
          <Suspense>
            {{
              default: () => <PostsList />,
              fallback: () => <div>Loading posts...</div>,
            }}
          </Suspense>
          <hr />
          <Outlet />
        </div>
      )
    }
  },
})

export const Route = createFileRoute('/posts')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(postsQueryOptions())
  },
  head: () => ({ meta: [{ title: 'Posts' }] }),
  component: PostsComponent,
})
