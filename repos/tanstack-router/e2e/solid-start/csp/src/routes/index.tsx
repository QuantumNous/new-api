import { createSignal } from 'solid-js'
import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const [count, setCount] = createSignal(0)

  return (
    <div>
      <h1 data-testid="csp-heading">CSP Nonce Test</h1>
      <p data-testid="inline-styled" class="inline-styled">
        This should be green if inline styles work
      </p>
      <p data-testid="external-styled" class="external-styled">
        This should be blue if external styles work
      </p>
      <button data-testid="counter-btn" onClick={() => setCount((c) => c + 1)}>
        Count: <span data-testid="counter-value">{count()}</span>
      </button>
    </div>
  )
}
