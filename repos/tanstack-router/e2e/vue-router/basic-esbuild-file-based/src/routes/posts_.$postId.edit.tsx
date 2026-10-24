import { createFileRoute, getRouteApi, useParams } from '@tanstack/vue-router'

export const Route = createFileRoute('/posts_/$postId/edit')({
  component: PostEditComponent,
})

const api = getRouteApi('/posts_/$postId/edit')

function PostEditComponent() {
  const paramsViaApi = api.useParams()
  const paramsViaHook = useParams({ from: '/posts_/$postId/edit' })
  const paramsViaRouteHook = api.useParams()

  return (
    <div>
      <div data-testid="params-via-hook">{paramsViaHook.value.postId}</div>
      <div data-testid="params-via-route-hook">
        {paramsViaRouteHook.value.postId}
      </div>
      <div data-testid="params-via-route-api">{paramsViaApi.value.postId}</div>
    </div>
  )
}
