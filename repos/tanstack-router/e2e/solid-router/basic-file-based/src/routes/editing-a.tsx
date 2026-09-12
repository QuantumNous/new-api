import { createFileRoute } from '@tanstack/solid-router'
import { useBlocker } from '@tanstack/solid-router'
import { createSignal } from 'solid-js'

export const Route = createFileRoute('/editing-a')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()
  const [input, setInput] = createSignal('')

  const blocker = useBlocker({
    shouldBlockFn: ({ next }) => {
      if (next.fullPath === '/editing-b' && input().length > 0) {
        return true
      }
      return false
    },
    withResolver: true,
  })

  return (
    <div>
      <h1>Editing A</h1>
      <label>
        Enter your name:
        <input
          name="input"
          value={input()}
          onChange={(e) => setInput(e.target.value)}
        />
      </label>
      <button
        onClick={() => {
          navigate({ to: '/editing-b' })
        }}
      >
        Go to next step
      </button>
      {blocker().status === 'blocked' && (
        <button onClick={() => blocker().proceed?.()}>Proceed</button>
      )}
    </div>
  )
}
