import { createFileRoute, getRouteApi, useParams } from '@tanstack/solid-router'

export const Route = createFileRoute('/posts_/$postId/edit')({
  component: PostEditPage,
})

const api = getRouteApi(`/posts_/$postId/edit`)

function PostEditPage() {
  const paramsViaApi = api.useParams()
  const paramsViaHook = useParams({ from: `/posts_/$postId/edit` })
  const paramsViaRouteHook = Route.useParams()

  return (
    <>
      <div data-testid="params-via-hook">{paramsViaHook().postId}</div>
      <div data-testid="params-via-route-hook">
        {paramsViaRouteHook().postId}
      </div>
      <div data-testid="params-via-route-api">{paramsViaApi().postId}</div>
    </>
  )
}
