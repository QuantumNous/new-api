import { Await, createFileRoute, notFound } from '@tanstack/solid-router'
import type { PostType } from './route'

async function fetchPostById(postId: string) {
  console.info(`Fetching post with id ${postId}...`)

  await new Promise((r) => setTimeout(r, 100 + Math.round(Math.random() * 100)))

  const res = await fetch(
    `https://jsonplaceholder.typicode.com/posts/${postId}`,
  )

  if (res.status === 404) throw notFound()

  return res.json() as Promise<PostType>
}

export type CommentType = {
  id: string
  postId: string
  name: string
  email: string
  body: string
}

async function fetchComments(postId: string) {
  await new Promise((r) => setTimeout(r, 2000))

  return fetch(
    `https://jsonplaceholder.typicode.com/comments?postId=${postId}`,
  ).then((r) => r.json() as Promise<Array<CommentType>>)
}

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params: { postId } }) => {
    const commentsPromise = fetchComments(postId)
    const post = await fetchPostById(postId)

    return {
      post,
      commentsPromise: commentsPromise,
    }
  },
  wrapInSuspense: true,
  errorComponent: ({ error }) => {
    return <div>Failed to load post: {(error as any).message}</div>
  },
  notFoundComponent: () => {
    return <div>Post not found</div>
  },
  component: PostComponent,
})

function PostComponent() {
  const loaderData = Route.useLoaderData()

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">{loaderData().post.title}</h4>
      <div class="text-sm">{loaderData().post.body}</div>
      <Await
        promise={loaderData().commentsPromise}
        fallback={<div>Loading comments...</div>}
      >
        {(comments) => {
          return (
            <div class="space-y-2">
              <h5 class="text-lg font-bold underline">Comments</h5>
              {comments.map((comment) => {
                return (
                  <div>
                    <h6 class="text-md font-bold">{comment.name}</h6>
                    <div class="text-sm italic opacity-50">{comment.email}</div>
                    <div class="text-sm">{comment.body}</div>
                  </div>
                )
              })}
            </div>
          )
        }}
      </Await>
    </div>
  )
}
