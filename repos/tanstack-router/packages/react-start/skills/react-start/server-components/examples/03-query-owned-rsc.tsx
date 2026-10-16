// Query-owned RSC pattern.
// Assumes your router context provides a queryClient for SSR prefetch.

import type { ReactNode } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  CompositeComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { z } from 'zod'

// Replace with your own data layer
declare const db: {
  posts: {
    findById(postId: string): Promise<{
      id: string
      title: string
      body: string
    }>
    update(
      postId: string,
      patch: { title?: string; body?: string },
    ): Promise<void>
  }
}

const getPostRsc = createServerFn({ method: 'GET' })
  .validator(z.object({ postId: z.string() }))
  .handler(async ({ data }) => {
    const post = await db.posts.findById(data.postId)

    const src = await createCompositeComponent<{
      renderActions?: (args: { postId: string }) => ReactNode
    }>((props) => (
      <article>
        <h1>{post.title}</h1>
        <p>{post.body}</p>
        <footer>{props.renderActions?.({ postId: post.id })}</footer>
      </article>
    ))

    return { src }
  })

const updatePost = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      postId: z.string(),
      title: z.string().optional(),
      body: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await db.posts.update(data.postId, {
      title: data.title,
      body: data.body,
    })
  })

const postQueryOptions = (postId: string) => ({
  queryKey: ['post-rsc', postId],
  structuralSharing: false,
  queryFn: () => getPostRsc({ data: { postId } }),
  staleTime: 5 * 60 * 1000,
})

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(postQueryOptions(params.postId))
  },
  component: PostPage,
})

function PostPage() {
  const { postId } = Route.useParams()
  const queryClient = useQueryClient()

  const { data } = useSuspenseQuery(postQueryOptions(postId))

  const handleRename = async () => {
    await updatePost({ data: { postId, title: 'Updated title' } })
    await queryClient.invalidateQueries({ queryKey: ['post-rsc', postId] })
  }

  return (
    <CompositeComponent
      src={data.src}
      renderActions={({ postId }) => (
        <button type="button" onClick={handleRename}>
          Refresh {postId}
        </button>
      )}
    />
  )
}
