import { createFileRoute, useLocation } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/specialChars/hash')({
  component: RouteComponent,
})

function RouteComponent() {
  const l = useLocation()
  const [toggleHashValue, setToggleHashValue] = useState(false)
  return (
    <div data-testid="special-hash-heading">
      <div>Hello "/specialChars/hash"!</div>
      <button
        className={
          'mt-2 mb-2 px-1 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition duration-200'
        }
        data-testid="toggle-hash-button"
        onClick={() => setToggleHashValue(!toggleHashValue)}
      >
        Toggle HashValue
      </button>
      <div>
        {toggleHashValue && (
          <div>
            Hash Value<span data-testid="special-hash">{l.hash}</span>
          </div>
        )}
      </div>
    </div>
  )
}
