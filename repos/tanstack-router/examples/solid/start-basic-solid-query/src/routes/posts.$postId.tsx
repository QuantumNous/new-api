import { ErrorComponent, Link, createFileRoute } from '@tanstack/solid-router'
import { useQuery } from '@tanstack/solid-query'
import { postQueryOptions } from '../utils/posts'
import type { ErrorComponentProps } from '@tanstack/solid-router'
import { NotFound } from '~/components/NotFound'

export function PostErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}

export const Route = createFileRoute('/posts/$postId')({
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
  notFoundComponent: () => {
    return <NotFound>Post not found</NotFound>
  },
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
          postId: postQuery.data!.id,
        }}
        activeProps={{ class: 'text-black font-bold' }}
        class="inline-block py-1 text-blue-800 hover:text-blue-600"
      >
        Deep View
      </Link>
    </div>
  )
}
