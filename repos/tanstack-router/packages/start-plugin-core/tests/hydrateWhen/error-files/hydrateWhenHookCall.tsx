import { Hydrate } from '@tanstack/react-start'
import { idle } from '@tanstack/react-start/hydration'

function useThing() {
  return 'thing'
}

export function Page() {
  return (
    <Hydrate when={idle()}>
      <p>{useThing()}</p>
    </Hydrate>
  )
}
