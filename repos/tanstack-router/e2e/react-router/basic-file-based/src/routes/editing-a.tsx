import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { useBlocker } from '@tanstack/react-router'

export const Route = createFileRoute('/editing-a')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()
  const [input, setInput] = React.useState('')

  const { proceed, status } = useBlocker({
    shouldBlockFn: ({ next }) => {
      if (next.fullPath === '/editing-b' && input.length > 0) {
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
          value={input}
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
      {status === 'blocked' && (
        <button onClick={() => proceed()}>Proceed</button>
      )}
    </div>
  )
}
