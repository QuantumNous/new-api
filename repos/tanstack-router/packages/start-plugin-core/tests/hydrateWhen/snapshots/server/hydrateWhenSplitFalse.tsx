import { Hydrate } from '@tanstack/react-start';
import { idle } from '@tanstack/react-start/hydration';
function Counter() {
  return <button>Count</button>;
}
export function Page() {
  return <Hydrate when={idle()} split={false}>
      <Counter />
    </Hydrate>;
}