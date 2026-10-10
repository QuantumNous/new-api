import { Hydrate } from '@tanstack/react-start'
import { idle } from '@tanstack/react-start/hydration'

export function Page() {
  return (
    <Hydrate when={idle()} split={false}>
      {() => <p>render prop stays inline</p>}
    </Hydrate>
  )
}
