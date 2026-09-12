import { createFileRoute } from '@tanstack/vue-router'
import { ErrorComponent, useRouter } from '@tanstack/vue-router'
import { useQuery } from '@tanstack/vue-query'
import { PostNotFoundError } from '../posts'
import { postQueryOptions } from '../postQueryOptions'
import type { ErrorComponentProps } from '@tanstack/vue-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: ({ context: { queryClient }, params: { postId } }) => {
    return queryClient.ensureQueryData(postQueryOptions(postId))
  },
  errorComponent: PostErrorComponent,
  component: PostComponent,
})

export function PostErrorComponent({ error }: ErrorComponentProps) {
  const router = useRouter()
  if (error instanceof PostNotFoundError) {
    return <div>{error.message}</div>
  }

  return (
    <div>
      <button
        onClick={() => {
          router.invalidate()
        }}
      >
        retry
      </button>
      <ErrorComponent error={error} />
    </div>
  )
}

function PostComponent() {
  const postId = Route.useParams().value.postId
  useQuery(postQueryOptions(postId))
  const post = Route.useLoaderData()

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">{post.value.title}</h4>
      <div class="text-sm">{post.value.body}</div>
    </div>
  )
}
