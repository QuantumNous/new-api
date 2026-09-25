import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { useBlocker } from '@tanstack/react-router'

export const Route = createFileRoute('/editing-b')({
  component: RouteComponent,
})

function RouteComponent() {
  const navigate = Route.useNavigate()
  const [input, setInput] = React.useState('')

  const { proceed, status } = useBlocker({
    condition: input,
  })

  return (
    <div>
      <h1>Editing B</h1>
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
          navigate({ to: '/editing-a' })
        }}
      >
        Go back
      </button>
      {status === 'blocked' && (
        <button onClick={() => proceed()}>Proceed</button>
      )}
    </div>
  )
}
