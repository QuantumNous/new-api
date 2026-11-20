import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/posts/$postId')({
  beforeLoad: () => {
    console.log(
      `beforeLoad for ${Route.id} called on the ${typeof window !== 'undefined' ? 'client' : 'server'}`,
    )
    return {
      postId: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  loader: () => {
    console.log(
      `loader for ${Route.id} called on the ${typeof window !== 'undefined' ? 'client' : 'server'}`,
    )
    return { postId: typeof window === 'undefined' ? 'server' : 'client' }
  },
  component: () => {
    const loaderData = Route.useLoaderData()
    const context = Route.useRouteContext()
    return (
      <div data-testid="postId-container">
        <h4 data-testid="postId-heading">postId</h4>
        <div>
          loader: <b data-testid="postId-loader">{loaderData.value.postId}</b>
        </div>
        <div>
          context: <b data-testid="postId-context">{context.value.postId}</b>
        </div>
      </div>
    )
  },
  pendingComponent: () => <div>$postId Loading...</div>,
})
