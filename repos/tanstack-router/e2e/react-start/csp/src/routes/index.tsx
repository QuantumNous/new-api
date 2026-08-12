import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [count, setCount] = useState(0)

  return (
    <div>
      <h1 data-testid="csp-heading">CSP Nonce Test</h1>
      <p data-testid="inline-styled" className="inline-styled">
        This should be green if inline styles work
      </p>
      <p data-testid="external-styled" className="external-styled">
        This should be blue if external styles work
      </p>
      <button data-testid="counter-btn" onClick={() => setCount((c) => c + 1)}>
        Count: <span data-testid="counter-value">{count}</span>
      </button>
    </div>
  )
}
