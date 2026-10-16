import { createFileRoute } from '@tanstack/solid-router'
import { ErrorComponent, useRouter } from '@tanstack/solid-router'
import { useQuery } from '@tanstack/solid-query'
import { createEffect, createMemo } from 'solid-js'
import { PostNotFoundError } from '../posts'
import { postQueryOptions } from '../postQueryOptions'
import { queryClient } from '../main'
import type { ErrorComponentProps } from '@tanstack/solid-router'

export function PostErrorComponent({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  if (error instanceof PostNotFoundError) {
    return <div>{error.message}</div>
  }

  createEffect(() => {
    reset()
    queryClient.resetQueries()
  })

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

export const Route = createFileRoute('/posts/$postId')({
  loader: ({ context: { queryClient }, params: { postId } }) => {
    return queryClient.ensureQueryData(postQueryOptions(postId))
  },
  errorComponent: PostErrorComponent,
  component: PostComponent,
})

function PostComponent() {
  const params = Route.useParams()
  const post = createMemo(() =>
    useQuery(() => postQueryOptions(params().postId)),
  )

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">{post().data?.title}</h4>
      <div class="text-sm">{post().data?.body}</div>
    </div>
  )
}
