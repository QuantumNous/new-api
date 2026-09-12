import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn, useServerFn } from '@tanstack/solid-start'
import { setResponseStatus } from '@tanstack/solid-start/server'

const helloFn = createServerFn().handler(() => {
  setResponseStatus(225, `hello`)
  return {
    hello: 'world',
  }
})

export const Route = createFileRoute('/status')({
  component: StatusComponent,
})

function StatusComponent() {
  const hello = useServerFn(helloFn)

  return (
    <div class="p-2">
      <button
        data-testid="invoke-server-fn"
        class="px-4 py-2 bg-blue-500 text-white rounded-md"
        onClick={() => hello()}
      >
        click me
      </button>
    </div>
  )
}
