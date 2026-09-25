import { useQuery } from '@tanstack/vue-query'
import {
  ErrorComponent,
  Link,
  createFileRoute,
  ErrorComponentProps,
} from '@tanstack/vue-router'
import { postQueryOptions } from '~/utils/posts'

export function PostErrorComponent(props: ErrorComponentProps) {
  return <ErrorComponent error={props.error} />
}

function PostComponent() {
  const params = Route.useParams()
  const postQuery = useQuery(() => postQueryOptions(params.value.postId))

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">{postQuery.data.value?.title}</h4>
      <div class="text-sm">{postQuery.data.value?.body}</div>
      <Link
        to="/posts/$postId/deep"
        params={{
          postId: postQuery.data.value?.id ?? '',
        }}
        activeProps={{ class: 'text-black font-bold' }}
        class="inline-block py-1 text-blue-800 hover:text-blue-600"
      >
        Deep View
      </Link>
    </div>
  )
}

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(postQueryOptions(params.postId))
  },
  errorComponent: PostErrorComponent,
  component: PostComponent,
})
