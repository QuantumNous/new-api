import { createFileRoute } from '@tanstack/solid-router'
import { getServerFn, postServerFn } from './-functions/normalServerFn'
import {
  getServerFnCallingServerFn,
  postServerFnCallingServerFn,
} from './-functions/serverFnCallingServerFn'

export const Route = createFileRoute('/function-metadata/')({
  component: RouteComponent,
  loader: async () => {
    const normalGet = await getServerFn()
    const normalPost = await postServerFn()
    const nestingGet = await getServerFnCallingServerFn()
    const nestingPost = await postServerFnCallingServerFn()

    return {
      normalGet,
      normalPost,
      nestingGet,
      nestingPost,
    }
  },
})

function RouteComponent() {
  const loaderData = Route.useLoaderData()

  return (
    <div class="p-2 m-2 grid gap-2" data-testid="metadata-route-component">
      <h1 class="font-bold text-lg">Server functions metadata E2E tests</h1>
      <br />
      <div data-testid="loader-data">
        <h3>Loader Data (SSR)</h3>
        <h4>Server Captured Metadata:</h4>
        <div>
          Function Metadata:{' '}
          <span data-testid="loader-normal-get-function-metadata">
            {JSON.stringify(loaderData().normalGet)}
          </span>
        </div>
        <div>
          Function Metadata:{' '}
          <span data-testid="loader-normal-post-function-metadata">
            {JSON.stringify(loaderData().normalPost)}
          </span>
        </div>
        <div>
          Function Metadata:{' '}
          <span data-testid="loader-nesting-get-function-metadata">
            {JSON.stringify(loaderData().nestingGet)}
          </span>
        </div>
        <div>
          Function Metadata:{' '}
          <span data-testid="loader-nesting-post-function-metadata">
            {JSON.stringify(loaderData().nestingPost)}
          </span>
        </div>
      </div>
    </div>
  )
}
