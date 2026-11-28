import { createFileRoute } from '@tanstack/solid-router'
import { useBlocker } from '@tanstack/solid-router'
import { createEffect, createSignal, createMemo } from 'solid-js'

export const Route = createFileRoute('/editing-b')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()
  const [input, setInput] = createSignal('')

  const blocker = createMemo(() =>
    useBlocker({
      condition: input(),
    }),
  )

  return (
    <div>
      <h1>Editing B</h1>
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
          navigate({ to: '/editing-a' })
        }}
      >
        Go back
      </button>
      {blocker()().status === 'blocked' && (
        <button onClick={() => blocker()().proceed?.()}>Proceed</button>
      )}
    </div>
  )
}
