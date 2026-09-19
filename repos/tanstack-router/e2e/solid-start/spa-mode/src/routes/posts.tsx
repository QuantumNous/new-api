import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/posts')({
  beforeLoad: () => {
    console.log(
      `beforeLoad for ${Route.id} called on the ${typeof window !== 'undefined' ? 'client' : 'server'}`,
    )
    return {
      posts: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  loader: () => {
    console.log(
      `loader for ${Route.id} called on the ${typeof window !== 'undefined' ? 'client' : 'server'}`,
    )

    return { posts: typeof window === 'undefined' ? 'server' : 'client' }
  },
  component: () => {
    const loaderData = Route.useLoaderData()
    const context = Route.useRouteContext()
    return (
      <div data-testid="posts-container">
        <h3 data-testid="posts-heading">posts</h3>
        <div>
          loader: <b data-testid="posts-loader">{loaderData().posts}</b>
        </div>
        <div>
          context: <b data-testid="posts-context">{context().posts}</b>
        </div>
        <hr />
        <Outlet />
      </div>
    )
  },
  pendingComponent: () => <div>posts Loading...</div>,
})
