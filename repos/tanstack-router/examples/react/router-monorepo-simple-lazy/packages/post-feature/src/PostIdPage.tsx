import { createLazyRoute } from '@router-mono-simple-lazy/router'

export const PostIdRoute = createLazyRoute('/$postId')({
  component: PostIdComponent,
})

export function PostIdComponent() {
  const post = PostIdRoute.useLoaderData()

  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{post.title}</h4>
      <div className="text-sm">{post.body}</div>
    </div>
  )
}
