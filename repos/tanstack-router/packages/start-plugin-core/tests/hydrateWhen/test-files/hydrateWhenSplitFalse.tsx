import { Hydrate } from '@tanstack/react-start'
import { idle } from '@tanstack/react-start/hydration'

const fallback = <div data-testid="split-false-fallback">Loading</div>

function Counter() {
  return <button>Count</button>
}

export function Page() {
  return (
    <Hydrate when={idle()} split={false} fallback={fallback}>
      <Counter />
    </Hydrate>
  )
}
