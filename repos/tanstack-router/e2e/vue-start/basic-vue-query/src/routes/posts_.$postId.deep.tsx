import { Link, createFileRoute } from '@tanstack/vue-router'
import { useQuery } from '@tanstack/vue-query'
import { postQueryOptions } from '../utils/posts'
import { PostErrorComponent } from './posts.$postId'

function PostDeepComponent() {
  const params = Route.useParams()
  const postQuery = useQuery(() => postQueryOptions(params.value.postId))

  return (
    <div class="p-2 space-y-2">
      <Link to="/posts" class="block py-1 text-blue-800 hover:text-blue-600">
        ← All Posts
      </Link>
      <h4 class="text-xl font-bold underline">{postQuery.data.value?.title}</h4>
      <div class="text-sm">{postQuery.data.value?.body}</div>
    </div>
  )
}

export const Route = createFileRoute('/posts_/$postId/deep')({
  loader: async ({ params: { postId }, context }) => {
    const data = await context.queryClient.ensureQueryData(
      postQueryOptions(postId),
    )

    return {
      title: data.title,
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: loaderData.title }] : undefined,
  }),
  errorComponent: PostErrorComponent,
  component: PostDeepComponent,
})
