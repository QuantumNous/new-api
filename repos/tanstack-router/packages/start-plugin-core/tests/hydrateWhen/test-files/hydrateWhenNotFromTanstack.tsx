import { Hydrate } from 'not-tanstack-start'
import { visible } from '@tanstack/react-start/hydration'

export function Page() {
  return (
    <Hydrate when={visible()}>
      <p>No transform</p>
    </Hydrate>
  )
}
