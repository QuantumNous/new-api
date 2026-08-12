import { useQuery } from '@tanstack/solid-query'
import { ErrorComponent, Link, createFileRoute } from '@tanstack/solid-router'
import { postQueryOptions } from '~/utils/posts'

export function PostErrorComponent({ error }: { error: any }) {
  return <ErrorComponent error={error} />
}

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(postQueryOptions(params.postId))
  },
  errorComponent: PostErrorComponent,
  component: PostComponent,
})

function PostComponent() {
  const params = Route.useParams()
  const postQuery = useQuery(() => postQueryOptions(params().postId))

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">{postQuery.data?.title}</h4>
      <div class="text-sm">{postQuery.data?.body}</div>
      <Link
        to="/posts/$postId/deep"
        params={{
          postId: postQuery.data?.id ?? '',
        }}
        activeProps={{ class: 'text-black font-bold' }}
        class="inline-block py-1 text-blue-800 hover:text-blue-600"
      >
        Deep View
      </Link>
    </div>
  )
}
