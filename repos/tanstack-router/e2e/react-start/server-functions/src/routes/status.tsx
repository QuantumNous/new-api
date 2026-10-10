import { createFileRoute } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'

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
    <div className="p-2">
      <button
        data-testid="invoke-server-fn"
        className="px-4 py-2 bg-blue-500 text-white rounded-md"
        onClick={() => hello()}
      >
        click me
      </button>
    </div>
  )
}
