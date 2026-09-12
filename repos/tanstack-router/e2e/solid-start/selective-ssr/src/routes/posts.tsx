import { Outlet, createFileRoute } from '@tanstack/solid-router'
import z from 'zod'
import { ssrSchema } from '~/search'

export const Route = createFileRoute('/posts')({
  validateSearch: z.object({ posts: ssrSchema }),
  ssr: ({ search }) => {
    if (typeof window !== 'undefined') {
      const error = `ssr() for ${Route.id} should not be called on the client`
      console.error(error)
      throw new Error(error)
    }
    if (search.status === 'success') {
      return search.value.posts?.ssr
    }
  },
  beforeLoad: ({ search }) => {
    console.log(
      `beforeLoad for ${Route.id} called on the ${typeof window !== 'undefined' ? 'client' : 'server'}`,
    )
    if (
      search.posts?.expected?.data === 'client' &&
      typeof window === 'undefined'
    ) {
      const error = `Expected beforeLoad for ${Route.id} to be executed on the client, but it is running on the server`
      console.error(error)
      throw new Error(error)
    }
    return {
      posts: typeof window === 'undefined' ? 'server' : 'client',
      search,
    }
  },
  loader: ({ context }) => {
    console.log(
      `loader for ${Route.id} called on the ${typeof window !== 'undefined' ? 'client' : 'server'}`,
    )

    if (
      context.search.posts?.expected?.data === 'client' &&
      typeof window === 'undefined'
    ) {
      const error = `Expected loader for ${Route.id} to be executed on the client, but it is running on the server`
      console.error(error)
      throw new Error(error)
    }
    return { posts: typeof window === 'undefined' ? 'server' : 'client' }
  },
  component: () => {
    const search = Route.useSearch()
    const loaderData = Route.useLoaderData()
    const context = Route.useRouteContext()
    if (
      typeof window === 'undefined' &&
      search().posts?.expected?.render === 'client-only'
    ) {
      const error = `Expected component for ${Route.id} to be executed on the client, but it is running on the server`
      console.error(error)
      throw new Error(error)
    }
    return (
      <div data-testid="posts-container">
        <h3 data-testid="posts-heading">posts</h3>
        <div>
          ssr: <b>{JSON.stringify(search().posts?.ssr ?? 'undefined')}</b>
        </div>
        <div>
          expected data location execution:{' '}
          <b data-testid="posts-data-expected">
            {search().posts?.expected?.data}
          </b>
        </div>
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
})
