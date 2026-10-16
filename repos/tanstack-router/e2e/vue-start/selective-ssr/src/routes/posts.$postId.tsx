import { createFileRoute } from '@tanstack/vue-router'
import z from 'zod'
import { ssrSchema } from '~/search'

export const Route = createFileRoute('/posts/$postId')({
  validateSearch: z.object({ postId: ssrSchema }),
  ssr: ({ search }) => {
    if (typeof window !== 'undefined') {
      const error = `ssr() for ${Route.id} should not be called on the client`
      console.error(error)
      throw new Error(error)
    }
    if (search.status === 'success') {
      return search.value.postId?.ssr
    }
  },
  beforeLoad: ({ search }) => {
    console.log(
      `beforeLoad for ${Route.id} called on the ${typeof window !== 'undefined' ? 'client' : 'server'}`,
    )
    if (
      search.postId?.expected?.data === 'client' &&
      typeof window === 'undefined'
    ) {
      const error = `Expected beforeLoad for ${Route.id} to be executed on the client, but it is running on the server`
      console.error(error)
      throw new Error(error)
    }
    return {
      postId: typeof window === 'undefined' ? 'server' : 'client',
      search,
    }
  },
  loader: ({ context }) => {
    console.log(
      `loader for ${Route.id} called on the ${typeof window !== 'undefined' ? 'client' : 'server'}`,
    )

    if (
      context.search.postId?.expected?.data === 'client' &&
      typeof window === 'undefined'
    ) {
      const error = `Expected loader for ${Route.id} to be executed on the client, but it is running on the server`
      console.error(error)
      throw new Error(error)
    }
    return { postId: typeof window === 'undefined' ? 'server' : 'client' }
  },
  component: () => {
    const search = Route.useSearch()
    const loaderData = Route.useLoaderData()
    const context = Route.useRouteContext()
    if (
      typeof window === 'undefined' &&
      search.value.postId?.expected?.render === 'client-only'
    ) {
      const error = `Expected component for ${Route.id} to be executed on the client, but it is running on the server`
      console.error(error)
      throw new Error(error)
    }
    return (
      <div data-testid="postId-container">
        <h4 data-testid="postId-heading">postId</h4>
        <div>
          ssr: <b>{JSON.stringify(search.value.postId?.ssr ?? 'undefined')}</b>
        </div>
        <div>
          expected data location execution:{' '}
          <b data-testid="postId-data-expected">
            {search.value.postId?.expected?.data}
          </b>
        </div>
        <div>
          loader: <b data-testid="postId-loader">{loaderData.value.postId}</b>
        </div>
        <div>
          context: <b data-testid="postId-context">{context.value.postId}</b>
        </div>
      </div>
    )
  },
})
