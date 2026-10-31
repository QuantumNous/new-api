import { ErrorComponent, Link, createFileRoute } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { fetchPost } from '~/utils/posts'

export const Route = createFileRoute('/posts_/$postId/deep')({
  loader: async ({ params: { postId } }) => fetchPost({ data: postId }),
  errorComponent: PostDeepErrorComponent,
  component: PostDeepComponent,
})

function PostDeepErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}

function PostDeepComponent() {
  const post = Route.useLoaderData()

  return (
    <div className="p-2 space-y-2">
      <Link
        to="/posts"
        className="block py-1 text-blue-800 hover:text-blue-600"
      >
        ← All Posts
      </Link>
      <h4 className="text-xl font-bold underline">{post.title}</h4>
      <div className="text-sm">{post.body}</div>
    </div>
  )
}
